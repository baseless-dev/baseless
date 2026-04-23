// deno-lint-ignore-file no-explicit-any explicit-function-return-type
import { TableProvider } from "@baseless/server";
import type { Client, InValue } from "@libsql/client";
import { visit } from "@baseless/core/query";
import type { TAnyFragment, TStatement, Visitor } from "@baseless/core/query";

/** A collected SQL fragment and its positional bind values. */
interface SqlFragment {
	sql: string;
	args: InValue[];
}

/** Mutable context threaded through the visitor. */
interface SqlContext {
	args: InValue[];
	params: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function quoteIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

function inlineLiteral(data: unknown): string {
	if (data === null || data === undefined) return "NULL";
	if (typeof data === "boolean") return data ? "1" : "0";
	if (typeof data === "number") return String(data);
	if (data instanceof Date) return `'${data.toISOString().replace(/'/g, "''")}'`;
	if (typeof data === "string") return `'${data.replace(/'/g, "''")}'`;
	return "?";
}

/** Returns true when the expression will resolve to SQL NULL. */
function isNullExpr(expr: TAnyFragment, params: Record<string, unknown>): boolean {
	if (expr.type === "literal") return expr.data === null || expr.data === undefined;
	if (expr.type === "paramref") {
		const val = params[(expr as any).param];
		return val === null || val === undefined;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Visitor
// ---------------------------------------------------------------------------

const libSQLVisitor: Visitor<string, SqlContext> = {
	visitLiteral(node, _visit, _ctx) {
		return inlineLiteral(node.data);
	},

	visitNamedParamReference(node, _visit, ctx) {
		const val = ctx.params[node.param];
		if (val === null || val === undefined) return "NULL";
		if (val instanceof Date) {
			ctx.args.push(val.toISOString());
			return "?";
		}
		ctx.args.push(val as InValue);
		return "?";
	},

	visitColumnReference(node, _visit, _ctx) {
		if (!node.table) {
			return quoteIdent(node.column as string);
		}
		return `${quoteIdent(node.table)}.${quoteIdent(node.column as string)}`;
	},

	visitTableReference(node, _visit, _ctx) {
		let sql = quoteIdent(node.table);
		if (node.alias) sql += ` AS ${quoteIdent(node.alias)}`;
		return sql;
	},

	visitNamedFunctionReference(node, visit, ctx) {
		return `${node.name}(${node.params.map((p: any) => visit(p, ctx)).join(", ")})`;
	},

	visitSubqueryExpression(node, visit, ctx) {
		return `(${visit(node.select, ctx)})`;
	},

	visitBooleanComparisonExpression(node, visit, ctx) {
		switch (node.operator) {
			case "eq": {
				if (isNullExpr(node.right, ctx.params)) return `${visit(node.left, ctx)} IS NULL`;
				return `${visit(node.left, ctx)} = ${visit(node.right, ctx)}`;
			}
			case "ne": {
				if (isNullExpr(node.right, ctx.params)) return `${visit(node.left, ctx)} IS NOT NULL`;
				return `${visit(node.left, ctx)} != ${visit(node.right, ctx)}`;
			}
			case "gt":
				return `${visit(node.left, ctx)} > ${visit(node.right, ctx)}`;
			case "gte":
				return `${visit(node.left, ctx)} >= ${visit(node.right, ctx)}`;
			case "lt":
				return `${visit(node.left, ctx)} < ${visit(node.right, ctx)}`;
			case "lte":
				return `${visit(node.left, ctx)} <= ${visit(node.right, ctx)}`;
			case "in":
				return `${visit(node.left, ctx)} IN (${visit(node.right, ctx)})`;
			case "nin":
				return `${visit(node.left, ctx)} NOT IN (${visit(node.right, ctx)})`;
			case "like":
				return `${visit(node.left, ctx)} LIKE ${visit(node.right, ctx)}`;
			case "notLike":
				return `${visit(node.left, ctx)} NOT LIKE ${visit(node.right, ctx)}`;
			case "and":
				return `(${visit(node.left, ctx)} AND ${visit(node.right, ctx)})`;
			case "or":
				return `(${visit(node.left, ctx)} OR ${visit(node.right, ctx)})`;
			default:
				return `${visit(node.left, ctx)} ${node.operator} ${visit(node.right, ctx)}`;
		}
	},

	visitBooleanExpression(node, visit, ctx) {
		if (node.operator === "not") {
			const [operand] = node.operands;
			return operand ? `(NOT ${visit(operand, ctx)})` : "(NOT)";
		}
		const op = node.operator === "and" ? " AND " : " OR ";
		return `(${node.operands.map((o) => visit(o, ctx)).join(op)})`;
	},

	visitSelectStatement(node, visit, ctx) {
		const selectEntries = Object.entries(node.select);
		const selectClause = selectEntries.length === 0
			? "*"
			: selectEntries.map(([alias, expr]) => `${visit(expr, ctx)} AS ${quoteIdent(alias)}`).join(", ");

		let fromClause = quoteIdent(node.from.table);
		if (node.from.alias) fromClause += ` AS ${quoteIdent(node.from.alias)}`;

		const joins = node.join.map((j) => visit(j, ctx)).join("");
		const where = node.where ? ` WHERE ${visit(node.where, ctx)}` : "";
		const groupBy = node.groupBy.length > 0 ? ` GROUP BY ${node.groupBy.map((g) => visit(g.column, ctx)).join(", ")}` : "";
		const having = node.having ? ` HAVING ${visit(node.having, ctx)}` : "";
		const orderBy = node.orderBy.length > 0 ? ` ORDER BY ${node.orderBy.map((o) => `${visit(o.column, ctx)} ${o.order}`).join(", ")}` : "";
		const limit = node.limit !== undefined ? ` LIMIT ${node.limit}` : "";
		const offset = node.offset !== undefined ? ` OFFSET ${node.offset}` : "";

		return `SELECT ${selectClause} FROM ${fromClause}${joins}${where}${groupBy}${having}${orderBy}${limit}${offset}`;
	},

	visitInsertStatement(node, visit, ctx) {
		const table = quoteIdent(node.into.table);

		if (node.from) {
			const selectSql = visit(node.from, ctx);
			let cols: string;
			if (node.columns.length > 0) {
				cols = ` (${node.columns.map(quoteIdent).join(", ")})`;
			} else {
				const selectKeys = Object.keys(node.from.select);
				cols = selectKeys.length > 0 ? ` (${selectKeys.map(quoteIdent).join(", ")})` : "";
			}
			return `INSERT INTO ${table}${cols} ${selectSql}`;
		}

		if (node.values && node.values.length > 0) {
			const allColumns = Object.keys(node.values[0]);
			const colList = allColumns.map(quoteIdent).join(", ");
			const rows = node.values.map((row) => {
				const vals = allColumns.map((col) => {
					const expr = row[col];
					return expr ? visit(expr, ctx) : "NULL";
				});
				return `(${vals.join(", ")})`;
			});
			return `INSERT INTO ${table} (${colList}) VALUES ${rows.join(", ")}`;
		}

		const cols = node.columns.length > 0 ? ` (${node.columns.map(quoteIdent).join(", ")})` : "";
		return `INSERT INTO ${table}${cols} DEFAULT VALUES`;
	},

	visitUpdateStatement(node, visit, ctx) {
		let tableClause = quoteIdent(node.table.table);
		if (node.table.alias) tableClause += ` AS ${quoteIdent(node.table.alias)}`;

		const setClauses = Object.entries(node.set)
			.map(([col, expr]) => `${quoteIdent(col)} = ${visit(expr, ctx)}`)
			.join(", ");
		const joins = node.join.map((j) => visit(j, ctx)).join("");
		const where = node.where ? ` WHERE ${visit(node.where, ctx)}` : "";
		const limit = node.limit !== undefined ? ` LIMIT ${node.limit}` : "";

		return `UPDATE ${tableClause}${joins} SET ${setClauses}${where}${limit}`;
	},

	visitDeleteStatement(node, visit, ctx) {
		let tableClause = quoteIdent(node.table.table);
		if (node.table.alias) tableClause += ` AS ${quoteIdent(node.table.alias)}`;

		const joins = node.join.map((j) => visit(j, ctx)).join("");
		const where = node.where ? ` WHERE ${visit(node.where, ctx)}` : "";
		const limit = node.limit !== undefined ? ` LIMIT ${node.limit}` : "";

		return `DELETE FROM ${tableClause}${joins}${where}${limit}`;
	},

	visitJoinFragment(node, visit, ctx) {
		const joinType = node.joinType?.toUpperCase();
		let sql = ` ${joinType ? `${joinType} ` : ""}JOIN ${quoteIdent(node.table)}`;
		if (node.alias) sql += ` AS ${quoteIdent(node.alias)}`;
		if (node.on) sql += ` ON ${visit(node.on, ctx)}`;
		return sql;
	},

	visitBatchStatement(_node, _visit, _ctx) {
		throw new Error("Batch statements are handled by execute(), not the visitor");
	},

	visitCheck(_node, _visit, _ctx) {
		throw new Error("Check fragments are handled by execute(), not the visitor");
	},
};

// ---------------------------------------------------------------------------
// Entry point: compile any single statement AST to {sql, args}
// ---------------------------------------------------------------------------

function compileSql(ast: TAnyFragment, params: Record<string, unknown>): SqlFragment {
	const ctx: SqlContext = { args: [], params };
	const sql = visit<string, SqlContext>(ast, libSQLVisitor, ctx);
	return { sql, args: ctx.args };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

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

	async execute<TParams extends Record<string, unknown>, TOutput>(
		statement: TStatement<TParams, TOutput>,
		params: TParams,
		options?: { signal?: AbortSignal },
	): Promise<TOutput> {
		options?.signal?.throwIfAborted();

		const ast = statement.statement;
		switch (ast.type) {
			case "select": {
				const frag = compileSql(ast, params);
				const rs = await this.#client.execute({ sql: frag.sql, args: frag.args });
				return rs.rows.map((r) => {
					const obj: Record<string, unknown> = {};
					for (let i = 0; i < rs.columns.length; i++) {
						obj[rs.columns[i]] = r[i];
					}
					return obj;
				}) as TOutput;
			}
			case "insert":
			case "update":
			case "delete": {
				const frag = compileSql(ast, params);
				await this.#client.execute({ sql: frag.sql, args: frag.args });
				return undefined as TOutput;
			}
			case "batch": {
				// Phase 1: Validate pre-condition checks.
				for (const check of ast.checks) {
					const frag = compileSql(check.select, params);
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
					const frag = compileSql(sub, params);
					batchStmts.push({ sql: frag.sql, args: frag.args });
				}

				if (batchStmts.length > 0) {
					await this.#client.batch(batchStmts, "write");
				}

				return undefined as TOutput;
			}
			default:
				throw new Error(`Unknown statement type: ${(ast as any).type}`);
		}
	}
}
