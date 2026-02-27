// deno-lint-ignore-file no-explicit-any
import { TableProvider } from "@baseless/server";
import type { Client, InValue } from "@libsql/client";
import type {
	TAnyStatement,
	TBooleanComparisonExpression,
	TBooleanExpression,
	TDeleteStatement,
	TExpression,
	TInsertStatement,
	TJoinFragment,
	TReferenceOrLiteral,
	TSelectStatement,
	TStatement,
	TUpdateStatement,
} from "@baseless/core/query";

/** A collected SQL fragment and its positional bind values. */
interface SqlFragment {
	sql: string;
	args: InValue[];
}

/**
 * {@link TableProvider} backed by a libSQL / Turso database via
 * `@libsql/client`.
 *
 * Translates the Baseless query AST into parameterised SQL strings and
 * executes them against the supplied {@link Client}.
 *
 * @example
 * ```ts
 * import { createClient } from "@libsql/client";
 * import { LibSQLTableProvider } from "@baseless/universal-provider/table";
 *
 * const client = createClient({ url: "file:local.db" });
 * const provider = new LibSQLTableProvider(client);
 * ```
 */
export class LibSQLTableProvider extends TableProvider {
	#client: Client;

	constructor(client: Client) {
		super();
		this.#client = client;
	}

	async execute(
		statement: TStatement<Record<string, unknown>, unknown>,
		params: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<unknown> {
		signal?.throwIfAborted();

		const ast = statement.statement;
		switch (ast.type) {
			case "select": {
				const frag = compileSelect(ast, params);
				const rs = await this.#client.execute({ sql: frag.sql, args: frag.args });
				return rs.rows.map((r) => {
					const obj: Record<string, unknown> = {};
					for (let i = 0; i < rs.columns.length; i++) {
						obj[rs.columns[i]] = r[i];
					}
					return obj;
				});
			}
			case "insert": {
				const frag = compileInsert(ast, params);
				await this.#client.execute({ sql: frag.sql, args: frag.args });
				return undefined;
			}
			case "update": {
				const frag = compileUpdate(ast, params);
				await this.#client.execute({ sql: frag.sql, args: frag.args });
				return undefined;
			}
			case "delete": {
				const frag = compileDelete(ast, params);
				await this.#client.execute({ sql: frag.sql, args: frag.args });
				return undefined;
			}
			case "batch": {
				// Phase 1: Validate pre-condition checks.
				// Run each check SELECT individually first so we can abort BEFORE
				// executing any mutating statements.
				for (const check of ast.checks) {
					const frag = compileSelect(check.select, params);
					const rs = await this.#client.execute({ sql: frag.sql, args: frag.args });
					const exists = rs.rows.length > 0;
					if (check.type === "exists" && !exists) {
						throw new Error("Batch pre-condition failed: expected rows to exist");
					}
					if (check.type === "not_exists" && exists) {
						throw new Error("Batch pre-condition failed: expected rows to not exist");
					}
				}

				// Phase 2: Execute all action statements atomically via client.batch().
				const batchStmts: { sql: string; args: InValue[] }[] = [];
				for (const sub of ast.statements) {
					let frag: SqlFragment;
					switch (sub.type) {
						case "insert":
							frag = compileInsert(sub, params);
							break;
						case "update":
							frag = compileUpdate(sub, params);
							break;
						case "delete":
							frag = compileDelete(sub, params);
							break;
						case "select":
							frag = compileSelect(sub, params);
							break;
						default:
							throw new Error(`Unsupported statement type in batch: ${(sub as any).type}`);
					}
					batchStmts.push({ sql: frag.sql, args: frag.args });
				}

				if (batchStmts.length > 0) {
					await this.#client.batch(batchStmts, "write");
				}

				return undefined;
			}
			default:
				throw new Error(`Unknown statement type: ${(ast as any).type}`);
		}
	}
}

// ---------------------------------------------------------------------------
// SQL Compilation helpers
// ---------------------------------------------------------------------------

function quoteIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

function resolveTableAlias(ref: { table: string; alias?: string }): string {
	return ref.alias ?? ref.table;
}

function compileExpression(expr: TExpression, params: Record<string, unknown>): SqlFragment {
	switch (expr.type) {
		case "literal": {
			if (expr.data === null) return { sql: "NULL", args: [] };
			if (expr.data instanceof Date) return { sql: "?", args: [expr.data.toISOString()] };
			return { sql: "?", args: [expr.data as InValue] };
		}
		case "paramref": {
			const val = params[expr.param];
			if (val === null || val === undefined) return { sql: "NULL", args: [] };
			if (val instanceof Date) return { sql: "?", args: [val.toISOString()] };
			return { sql: "?", args: [val as InValue] };
		}
		case "columnref": {
			return { sql: `${quoteIdent(expr.table)}.${quoteIdent(expr.column as string)}`, args: [] };
		}
		case "tableref": {
			return { sql: quoteIdent(expr.table), args: [] };
		}
		case "functionref": {
			const paramFrags: SqlFragment[] = expr.params.map((p: any) => compileExpression(p, params));
			const sql = `${expr.name}(${paramFrags.map((f: SqlFragment) => f.sql).join(", ")})`;
			return { sql, args: paramFrags.flatMap((f: SqlFragment) => f.args) };
		}
		case "booleancomparison": {
			return compileBooleanComparison(expr, params);
		}
		case "booleanexpression": {
			return compileBooleanExpression(expr, params);
		}
		default:
			throw new Error(`Unsupported expression type: ${(expr as any).type}`);
	}
}

function compileBooleanComparison(
	expr: TBooleanComparisonExpression<any>,
	params: Record<string, unknown>,
): SqlFragment {
	const left = compileExpression(expr.left, params);
	const right = compileExpression(expr.right, params);
	const args = [...left.args, ...right.args];

	switch (expr.operator) {
		case "eq":
			return right.sql === "NULL" ? { sql: `${left.sql} IS NULL`, args: left.args } : { sql: `${left.sql} = ${right.sql}`, args };
		case "ne":
			return right.sql === "NULL" ? { sql: `${left.sql} IS NOT NULL`, args: left.args } : { sql: `${left.sql} != ${right.sql}`, args };
		case "gt":
			return { sql: `${left.sql} > ${right.sql}`, args };
		case "gte":
			return { sql: `${left.sql} >= ${right.sql}`, args };
		case "lt":
			return { sql: `${left.sql} < ${right.sql}`, args };
		case "lte":
			return { sql: `${left.sql} <= ${right.sql}`, args };
		case "in":
			return { sql: `${left.sql} IN (${right.sql})`, args };
		case "nin":
			return { sql: `${left.sql} NOT IN (${right.sql})`, args };
		case "and": {
			const l = compileBooleanLike(expr.left, params);
			const r = compileBooleanLike(expr.right, params);
			return { sql: `(${l.sql} AND ${r.sql})`, args: [...l.args, ...r.args] };
		}
		case "or": {
			const l = compileBooleanLike(expr.left, params);
			const r = compileBooleanLike(expr.right, params);
			return { sql: `(${l.sql} OR ${r.sql})`, args: [...l.args, ...r.args] };
		}
		default:
			return { sql: `${left.sql} ${expr.operator} ${right.sql}`, args };
	}
}

function compileBooleanLike(
	expr: TExpression,
	params: Record<string, unknown>,
): SqlFragment {
	if (expr.type === "booleancomparison") return compileBooleanComparison(expr, params);
	if (expr.type === "booleanexpression") return compileBooleanExpression(expr, params);
	return compileExpression(expr, params);
}

function compileBooleanExpression(
	expr: TBooleanExpression<any>,
	params: Record<string, unknown>,
): SqlFragment {
	const op = expr.operator === "and" ? " AND " : " OR ";
	const parts = expr.operands.map((o) => compileBooleanLike(o, params));
	return {
		sql: `(${parts.map((p) => p.sql).join(op)})`,
		args: parts.flatMap((p) => p.args),
	};
}

function compileWhere(
	where: TExpression | TBooleanExpression<any> | undefined,
	params: Record<string, unknown>,
): SqlFragment {
	if (!where) return { sql: "", args: [] };
	const frag = compileBooleanLike(where, params);
	return { sql: ` WHERE ${frag.sql}`, args: frag.args };
}

function compileJoins(
	joins: TJoinFragment[] | undefined,
	params: Record<string, unknown>,
): SqlFragment {
	if (!joins || joins.length === 0) return { sql: "", args: [] };
	const parts: string[] = [];
	const args: InValue[] = [];
	for (const j of joins) {
		let sql = ` JOIN ${quoteIdent(j.table)}`;
		if (j.alias) sql += ` AS ${quoteIdent(j.alias)}`;
		if (j.on) {
			const onFrag = compileBooleanLike(j.on, params);
			sql += ` ON ${onFrag.sql}`;
			args.push(...onFrag.args);
		}
		parts.push(sql);
	}
	return { sql: parts.join(""), args };
}

function compileReferenceOrLiteral(
	expr: TReferenceOrLiteral,
	params: Record<string, unknown>,
): SqlFragment {
	return compileExpression(expr as TExpression, params);
}

// ---------------------------------------------------------------------------
// Statement compilers
// ---------------------------------------------------------------------------

function compileSelect(
	stmt: TSelectStatement,
	params: Record<string, unknown>,
): SqlFragment {
	const args: InValue[] = [];

	// SELECT columns
	const selectEntries = Object.entries(stmt.select);
	let selectClause: string;
	if (selectEntries.length === 0) {
		selectClause = "*";
	} else {
		const cols: string[] = [];
		for (const [alias, expr] of selectEntries) {
			const frag = compileReferenceOrLiteral(expr, params);
			cols.push(`${frag.sql} AS ${quoteIdent(alias)}`);
			args.push(...frag.args);
		}
		selectClause = cols.join(", ");
	}

	// FROM
	let fromClause = quoteIdent(stmt.from.table);
	if (stmt.from.alias) fromClause += ` AS ${quoteIdent(stmt.from.alias)}`;

	// JOINs
	const joinFrag = compileJoins(stmt.join, params);
	args.push(...joinFrag.args);

	// WHERE
	const whereFrag = compileWhere(stmt.where, params);
	args.push(...whereFrag.args);

	// GROUP BY
	let groupByClause = "";
	if (stmt.groupBy && stmt.groupBy.length > 0) {
		const cols = stmt.groupBy.map((g) => {
			const frag = compileReferenceOrLiteral(g.column, params);
			args.push(...frag.args);
			return frag.sql;
		});
		groupByClause = ` GROUP BY ${cols.join(", ")}`;
	}

	// ORDER BY
	let orderByClause = "";
	if (stmt.orderBy && stmt.orderBy.length > 0) {
		const cols = stmt.orderBy.map((o) => {
			const frag = compileReferenceOrLiteral(o.column, params);
			args.push(...frag.args);
			return `${frag.sql} ${o.order}`;
		});
		orderByClause = ` ORDER BY ${cols.join(", ")}`;
	}

	// LIMIT / OFFSET
	let limitClause = "";
	if (stmt.limit !== undefined) {
		limitClause = ` LIMIT ?`;
		args.push(stmt.limit);
	}
	let offsetClause = "";
	if (stmt.offset !== undefined) {
		offsetClause = ` OFFSET ?`;
		args.push(stmt.offset);
	}

	const sql =
		`SELECT ${selectClause} FROM ${fromClause}${joinFrag.sql}${whereFrag.sql}${groupByClause}${orderByClause}${limitClause}${offsetClause}`;
	return { sql, args };
}

function compileInsert(
	stmt: TInsertStatement,
	params: Record<string, unknown>,
): SqlFragment {
	const args: InValue[] = [];
	const table = quoteIdent(stmt.into.table);

	if (stmt.from) {
		// INSERT INTO ... SELECT ...
		const selectFrag = compileSelect(stmt.from, params);
		// Infer column list from the SELECT's named columns when not explicitly set
		let cols: string;
		if (stmt.columns.length > 0) {
			cols = ` (${stmt.columns.map(quoteIdent).join(", ")})`;
		} else {
			const selectKeys = Object.keys(stmt.from.select);
			cols = selectKeys.length > 0 ? ` (${selectKeys.map(quoteIdent).join(", ")})` : "";
		}
		return { sql: `INSERT INTO ${table}${cols} ${selectFrag.sql}`, args: selectFrag.args };
	}

	if (stmt.values && stmt.values.length > 0) {
		// INSERT INTO ... VALUES ...
		// Collect all column names from the first row
		const allColumns = Object.keys(stmt.values[0]);
		const colList = allColumns.map(quoteIdent).join(", ");
		const rowPlaceholders: string[] = [];

		for (const row of stmt.values) {
			const placeholders: string[] = [];
			for (const col of allColumns) {
				const expr = row[col];
				if (expr) {
					const frag = compileReferenceOrLiteral(expr, params);
					placeholders.push(frag.sql);
					args.push(...frag.args);
				} else {
					placeholders.push("NULL");
				}
			}
			rowPlaceholders.push(`(${placeholders.join(", ")})`);
		}

		return { sql: `INSERT INTO ${table} (${colList}) VALUES ${rowPlaceholders.join(", ")}`, args };
	}

	// No values and no from — degenerate INSERT
	const cols = stmt.columns.length > 0 ? ` (${stmt.columns.map(quoteIdent).join(", ")})` : "";
	return { sql: `INSERT INTO ${table}${cols} DEFAULT VALUES`, args };
}

function compileUpdate(
	stmt: TUpdateStatement,
	params: Record<string, unknown>,
): SqlFragment {
	const args: InValue[] = [];
	let tableClause = quoteIdent(stmt.table.table);
	if (stmt.table.alias) tableClause += ` AS ${quoteIdent(stmt.table.alias)}`;

	// SET
	const setClauses: string[] = [];
	for (const [col, expr] of Object.entries(stmt.set)) {
		const frag = compileReferenceOrLiteral(expr, params);
		setClauses.push(`${quoteIdent(col)} = ${frag.sql}`);
		args.push(...frag.args);
	}

	// JOINs
	const joinFrag = compileJoins(stmt.join, params);
	args.push(...joinFrag.args);

	// WHERE
	const whereFrag = compileWhere(stmt.where, params);
	args.push(...whereFrag.args);

	// LIMIT
	let limitClause = "";
	if (stmt.limit !== undefined) {
		limitClause = ` LIMIT ?`;
		args.push(stmt.limit);
	}

	const sql = `UPDATE ${tableClause}${joinFrag.sql} SET ${setClauses.join(", ")}${whereFrag.sql}${limitClause}`;
	return { sql, args };
}

function compileDelete(
	stmt: TDeleteStatement,
	params: Record<string, unknown>,
): SqlFragment {
	const args: InValue[] = [];
	let tableClause = quoteIdent(stmt.table.table);
	if (stmt.table.alias) tableClause += ` AS ${quoteIdent(stmt.table.alias)}`;

	// JOINs
	const joinFrag = compileJoins(stmt.join, params);
	args.push(...joinFrag.args);

	// WHERE
	const whereFrag = compileWhere(stmt.where, params);
	args.push(...whereFrag.args);

	// LIMIT
	let limitClause = "";
	if (stmt.limit !== undefined) {
		limitClause = ` LIMIT ?`;
		args.push(stmt.limit);
	}

	const sql = `DELETE FROM ${tableClause}${joinFrag.sql}${whereFrag.sql}${limitClause}`;
	return { sql, args };
}
