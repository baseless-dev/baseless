// deno-lint-ignore-file no-explicit-any
import { app, Permission, type PublicTableDefinition, TableDefinition } from "../app.ts";
import * as z from "@baseless/core/schema";
import {
	ExpressionBuilder,
	replace,
	type TAnyStatement,
	type TBooleanComparisonExpression,
	type TBooleanExpression,
	type TExpression,
	type TInsertStatement,
	type TNamedParamReference,
	type TSelectStatement,
	TStatement,
	visit,
	type Visitor,
} from "@baseless/core/query";
import { Response } from "@baseless/core/response";
import { ForbiddenError, TableNotFoundError } from "@baseless/core/errors";
import { first } from "@baseless/core/iter";

// ---------------------------------------------------------------------------
// Security helpers — applied only to client-facing requests
// ---------------------------------------------------------------------------

/**
 * Collects all table names referenced by the given AST statement.
 */
function collectTableNames(statement: TAnyStatement): Set<string> {
	const tables = new Set<string>();
	const noop = (_n: any, _v: any, _c: any) => {};
	const collectVisitor: Visitor<void, void> = {
		visitLiteral: noop,
		visitNamedFunctionReference: (_node, v) => {
			for (const p of _node.params) v(p, void 0);
		},
		visitTableReference: (node) => {
			tables.add(node.table);
		},
		visitColumnReference: noop,
		visitNamedParamReference: noop,
		visitBooleanExpression: (node, v) => {
			for (const op of node.operands) v(op, void 0);
		},
		visitBooleanComparisonExpression: (node, v) => {
			v(node.left, void 0);
			v(node.right, void 0);
		},
		visitSelectStatement: (node, v) => {
			v(node.from, void 0);
			for (const j of node.join) v(j as any, void 0);
			for (const s of Object.values(node.select)) v(s, void 0);
			if (node.where) v(node.where, void 0);
		},
		visitInsertStatement: (node, v) => {
			v(node.into, void 0);
			if (node.from) v(node.from, void 0);
			if (node.values) {
				for (const row of node.values) {
					for (const val of Object.values(row)) v(val, void 0);
				}
			}
		},
		visitUpdateStatement: (node, v) => {
			v(node.table, void 0);
			for (const j of (node.join ?? [])) v(j as any, void 0);
			for (const val of Object.values(node.set)) v(val, void 0);
			if (node.where) v(node.where, void 0);
		},
		visitDeleteStatement: (node, v) => {
			v(node.table, void 0);
			for (const j of (node.join ?? [])) v(j as any, void 0);
			if (node.where) v(node.where, void 0);
		},
		visitBatchStatement: (node, v) => {
			for (const c of node.checks) v(c, void 0);
			for (const s of node.statements) v(s, void 0);
		},
		visitJoinFragment: (node, v) => {
			tables.add(node.table);
			if (node.on) v(node.on, void 0);
		},
		visitCheck: (node, v) => {
			v(node.select, void 0);
		},
	};
	visit(statement, collectVisitor, void 0);
	return tables;
}

/**
 * Returns the required {@link Permission} flag for the given statement type.
 */
function permissionForStatement(stmt: TAnyStatement): number {
	switch (stmt.type) {
		case "select":
			return Permission.Select;
		case "insert":
			return Permission.Insert;
		case "update":
			return Permission.Update;
		case "delete":
			return Permission.Delete;
		case "batch":
			return Permission.Select | Permission.Insert | Permission.Update | Permission.Delete;
		default:
			return Permission.None;
	}
}

/**
 * Injects row-security WHERE clause into a statement, ANDing with any
 * existing `where` clause.
 */
function injectRowSecurity(
	statement: TAnyStatement,
	tableName: string,
	securityExpr: TBooleanComparisonExpression<any> | TBooleanExpression<any>,
): TAnyStatement {
	switch (statement.type) {
		case "select": {
			const where = statement.where
				? {
					type: "booleanexpression" as const,
					operator: "and",
					operands: [statement.where as TBooleanComparisonExpression<any> | TBooleanExpression<any>, securityExpr],
				} satisfies TBooleanExpression<any>
				: securityExpr;
			return { ...statement, where };
		}
		case "update": {
			if (statement.table.table !== tableName) return statement;
			const where = statement.where
				? {
					type: "booleanexpression" as const,
					operator: "and",
					operands: [statement.where as TBooleanComparisonExpression<any> | TBooleanExpression<any>, securityExpr],
				} satisfies TBooleanExpression<any>
				: securityExpr;
			return { ...statement, where };
		}
		case "delete": {
			if (statement.table.table !== tableName) return statement;
			const where = statement.where
				? {
					type: "booleanexpression" as const,
					operator: "and",
					operands: [statement.where as TBooleanComparisonExpression<any> | TBooleanExpression<any>, securityExpr],
				} satisfies TBooleanExpression<any>
				: securityExpr;
			return { ...statement, where };
		}
		case "insert": {
			if (statement.from) {
				const injectedFrom = injectRowSecurity(statement.from, tableName, securityExpr) as TSelectStatement;
				return { ...statement, from: injectedFrom };
			}
			return statement;
		}
		case "batch": {
			return {
				...statement,
				checks: statement.checks.map((c) => ({
					...c,
					select: injectRowSecurity(c.select, tableName, securityExpr) as TSelectStatement,
				})),
				statements: statement.statements.map((s) => injectRowSecurity(s, tableName, securityExpr)),
			};
		}
		default:
			return statement;
	}
}

/**
 * Substitutes all {@link TNamedParamReference} nodes in the AST with
 * {@link TLiteral} nodes based on the provided parameter map.
 */
function substituteParams(statement: TAnyStatement, params: Record<string, unknown>): TAnyStatement {
	return replace(statement, (node) => {
		if (node.type === "paramref") {
			const paramNode = node as TNamedParamReference<string>;
			if (paramNode.param in params) {
				return { type: "literal", data: params[paramNode.param] } as any;
			}
		}
		return undefined;
	}) as TAnyStatement;
}

/**
 * Validates that INSERT VALUES rows comply with a row-security expression.
 * Throws {@link ForbiddenError} if any row fails the check.
 */
function validateInsertValuesAgainstRowSecurity(
	statement: TInsertStatement,
	tableName: string,
	securityExpr: TBooleanComparisonExpression<any> | TBooleanExpression<any>,
): void {
	if (!statement.values || statement.into.table !== tableName) return;

	for (const row of statement.values) {
		if (!evaluateExprAgainstRow(securityExpr, row, tableName)) {
			throw new ForbiddenError();
		}
	}
}

/**
 * Evaluates a boolean expression against a single row of literal values.
 */
function evaluateExprAgainstRow(
	expr: TBooleanComparisonExpression<any> | TBooleanExpression<any>,
	row: Record<string, any>,
	tableName: string,
): boolean {
	if (expr.type === "booleanexpression") {
		const results = expr.operands.map((op) => evaluateExprAgainstRow(op, row, tableName));
		if (expr.operator === "and") return results.every(Boolean);
		if (expr.operator === "or") return results.some(Boolean);
		return false;
	}

	if (expr.type === "booleancomparison") {
		const left = resolveValueFromRow(expr.left, row, tableName);
		const right = resolveValueFromRow(expr.right, row, tableName);

		if (left === undefined || right === undefined) return true;

		switch (expr.operator) {
			case "eq":
				return left === right;
			case "ne":
				return left !== right;
			case "gt":
				return left > right;
			case "gte":
				return left >= right;
			case "lt":
				return left < right;
			case "lte":
				return left <= right;
			case "in":
				return Array.isArray(right) ? right.includes(left) : false;
			case "nin":
				return Array.isArray(right) ? !right.includes(left) : true;
			default:
				return true;
		}
	}

	return true;
}

/**
 * Resolves the runtime value of an expression node from a row's literal values.
 */
function resolveValueFromRow(
	expr: TExpression,
	row: Record<string, any>,
	tableName: string,
): any {
	if (expr.type === "literal") return expr.data;
	if (expr.type === "columnref") {
		if (expr.table === tableName) {
			const key = expr.column as string;
			if (key in row) {
				const val = row[key];
				return val.type === "literal" ? val.data : undefined;
			}
		}
		return undefined;
	}
	if (expr.type === "paramref") {
		return undefined;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Public table app — client-facing endpoint with full security enforcement
// ---------------------------------------------------------------------------

const tableApp = app()
	.endpoint({
		path: "table/execute",
		request: z.jsonRequest({
			statement: TStatement,
			params: z.record(z.string(), z.unknown()),
		}),
		response: z.jsonResponse({
			result: z.unknown(),
		}),
		handler: async ({ app, auth, configuration, context, service, request, signal, waitUntil }) => {
			const { statement, params } = request.body;
			let ast = (statement as any).statement as TAnyStatement;

			// 1. Collect all referenced table names and resolve definitions
			const tableNames = collectTableNames(ast);
			const definitions = new Map<string, TableDefinition>();
			for (const name of tableNames) {
				try {
					const [_params, definition] = first(app.match("table", name));
					definitions.set(name, definition);
				} catch (cause) {
					throw new TableNotFoundError(undefined, { cause });
				}
			}

			// 2. Check table-level security for each table
			const requiredPerm = permissionForStatement(ast);
			for (const [_name, definition] of definitions) {
				if ("tableSecurity" in definition) {
					const permission = await definition.tableSecurity({
						app,
						auth,
						configuration,
						context,
						params: {},
						service,
						signal,
						waitUntil,
					});
					if ((permission & requiredPerm) !== requiredPerm) {
						throw new ForbiddenError();
					}
				}
			}

			// 3. Inject row-level security WHERE clauses
			for (const [name, definition] of definitions) {
				if ("rowSecurity" in definition) {
					const securityExpr = await definition.rowSecurity({
						app,
						auth,
						configuration,
						context,
						q: new ExpressionBuilder(),
						params: {},
						service,
						signal,
						waitUntil,
					});

					// 3a. Inject into SELECT/UPDATE/DELETE WHERE
					ast = injectRowSecurity(ast, name, securityExpr);

					// 3b. Validate INSERT VALUES rows
					if (ast.type === "insert") {
						validateInsertValuesAgainstRowSecurity(ast, name, securityExpr);
					} else if (ast.type === "batch") {
						for (const sub of ast.statements) {
							if (sub.type === "insert") {
								validateInsertValuesAgainstRowSecurity(sub, name, securityExpr);
							}
						}
					}
				}
			}

			// 4. Substitute named parameters with literals
			ast = substituteParams(ast, params as Record<string, unknown>);

			// 5. Delegate to the table service (facade → provider)
			const resolved = { type: "statement" as const, statement: ast };
			const result = await service.table.execute(resolved as never, params as never, signal);
			return Response.json({ result });
		},
	});

export default tableApp;

/** The compiled table {@link App} returned by `tableApp.build()`. */
export type TableApplication = ReturnType<typeof tableApp.build>;
