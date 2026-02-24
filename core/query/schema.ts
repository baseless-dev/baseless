// deno-lint-ignore-file no-explicit-any ban-types
import * as z from "../schema.ts";

/**
 * AST node representing a constant literal value (string, number, boolean,
 * `null`, or `Date`).
 */
export interface TLiteral<TData> {
	type: "literal";
	data: TData;
}

/** Zod schema for {@link TLiteral}. */
export const TLiteral = z.strictObject({
	type: z.literal("literal"),
	data: z.any(),
}).meta({ id: "Literal" });

/**
 * AST node that refers to a named query parameter.
 * `TName` is the parameter name and `TData` is its expected value type.
 */
export interface TNamedParamReference<TName extends string | number | symbol, TData = any> {
	type: "paramref";
	param: TName;
}

/** Zod schema for {@link TNamedParamReference}. */
export const TNamedParamReference = z.strictObject({
	type: z.literal("paramref"),
	param: z.string(),
}).meta({ id: "NamedParamReference" });

/**
 * AST node that refers to a table (optionally aliased).
 */
export interface TNamedTableReference {
	type: "tableref";
	table: string;
	alias?: string;
}

/** Zod schema for {@link TNamedTableReference}. */
export const TNamedTableReference = z.strictObject({
	type: z.literal("table"),
	table: z.string(),
	alias: z.optional(z.string()),
}).meta({ id: "NamedTableReference" });

/**
 * AST node that refers to a column of a table.
 * `TName` is the column name and `TData` is the column's value type.
 */
export interface TNamedColumnReference<TName extends string | number | symbol, TData> {
	type: "columnref";
	table: string;
	column: TName;
}

/** Zod schema for {@link TNamedColumnReference}. */
export const TNamedColumnReference = z.strictObject({
	type: z.literal("columnref"),
	table: z.string(),
	column: z.string(),
}).meta({ id: "NamedColumnReference" });

/**
 * AST node representing a SQL function call.
 * `TName` is the function name, `TParams` the argument list, and `TOutput` the
 * return type.
 */
export interface TNamedFunctionReference<TName extends string | number | symbol, TParams extends TReferenceOrLiteral[], TOutput> {
	type: "functionref";
	name: TName;
	params: TParams;
}

/** Zod schema for {@link TNamedFunctionReference}. */
export const TNamedFunctionReference = z.strictObject({
	type: z.literal("functionref"),
	name: z.string(),
	params: z.array(z.any()),
}).meta({ id: "NamedFunctionReference" });

/**
 * AST node for a binary comparison expression (e.g. `=`, `!=`, `>`, `IN`).
 * `TParams` maps the named parameters referenced in this comparison to their
 * expected types.
 */
export interface TBooleanComparisonExpression<TParams extends {}> {
	type: "booleancomparison";
	operator: string;
	left: TExpression;
	right: TExpression;
}

/** Zod schema for {@link TBooleanComparisonExpression}. */
export const TBooleanComparisonExpression = z.strictObject({
	type: z.literal("booleancomparison"),
	operator: z.string(),
	get left() {
		return TExpression;
	},
	get right() {
		return TExpression;
	},
}).meta({ id: "BooleanComparisonExpression" });

/**
 * AST node that combines multiple {@link TBooleanComparisonExpression}s with
 * an `AND` or `OR` operator.
 */
export interface TBooleanExpression<TParams extends {}> {
	type: "booleanexpression";
	operator: string;
	operands: Array<TBooleanComparisonExpression<TParams> | TBooleanExpression<TParams>>;
}

/** Zod schema for {@link TBooleanExpression}. */
export const TBooleanExpression = z.strictObject({
	type: z.literal("booleanexpression"),
	operator: z.string(),
	get operands() {
		return z.array(z.union([TBooleanComparisonExpression, TBooleanExpression]));
	},
}).meta({ id: "BooleanExpression" });

/**
 * Union of all AST nodes that can appear as operands in expressions:
 * function references, table/column/param references, or literal values.
 */
export type TReferenceOrLiteral<TData = any> =
	| TNamedFunctionReference<string, TReferenceOrLiteral<TData>[], any>
	| TNamedTableReference
	| TNamedColumnReference<string, TData>
	| TNamedParamReference<string, TData>
	| TLiteral<TData>;

/** Zod schema for {@link TReferenceOrLiteral}. */
export const TReferenceOrLiteral = z.lazy(() =>
	z.union([
		TNamedFunctionReference,
		TNamedTableReference,
		TNamedColumnReference,
		TNamedParamReference,
		TLiteral,
	]).meta({ id: "ReferenceOrLiteral" })
);

/**
 * Union of all expression AST nodes — everything in {@link TReferenceOrLiteral}
 * plus boolean expressions and comparisons.
 */
export type TExpression =
	| TNamedFunctionReference<string, any, any>
	| TNamedTableReference
	| TNamedColumnReference<string, any>
	| TNamedParamReference<string>
	| TLiteral<any>
	| TBooleanExpression<any>
	| TBooleanComparisonExpression<any>;

/** Zod schema for {@link TExpression}. */
export const TExpression = z.union([
	TNamedFunctionReference,
	TNamedTableReference,
	TNamedColumnReference,
	TNamedParamReference,
	TLiteral,
	TBooleanExpression,
	TBooleanComparisonExpression,
]).meta({ id: "Expression" });

/**
 * AST fragment representing a SQL JOIN clause.
 */
export interface TJoinFragment {
	type: "join";
	table: string;
	alias?: string;
	on?: TBooleanComparisonExpression<any> | TBooleanExpression<any>;
}

/** Zod schema for {@link TJoinFragment}. */
export const TJoinFragment = z.strictObject({
	table: z.string(),
	alias: z.optional(z.string()),
	on: z.optional(z.union([TBooleanComparisonExpression, TBooleanExpression])),
}).meta({ id: "JoinFragment" });

/**
 * AST node for a SQL `SELECT` statement.
 */
export interface TSelectStatement {
	type: "select";
	from: TNamedTableReference;
	join: Array<TJoinFragment>;
	select: Record<string, TReferenceOrLiteral>;
	where?: TBooleanExpression<any> | TExpression;
	groupBy: Array<{
		column: TReferenceOrLiteral;
	}>;
	orderBy: Array<{
		column: TReferenceOrLiteral;
		order: "ASC" | "DESC";
	}>;
	limit?: number;
	offset?: number;
}

/** Zod schema for {@link TSelectStatement}. */
export const TSelectStatement = z.strictObject({
	type: z.literal("select"),
	from: TNamedTableReference,
	join: z.array(TJoinFragment),
	select: z.record(z.string(), TReferenceOrLiteral),
	where: z.union([TBooleanExpression, TExpression]),
	groupBy: z.array(z.strictObject({
		column: TReferenceOrLiteral,
	})),
	orderBy: z.array(z.strictObject({
		column: TReferenceOrLiteral,
		order: z.union([z.literal("ASC"), z.literal("DESC")]),
	})),
	limit: z.number(),
	offset: z.number(),
}).meta({ id: "SelectStatement" });

/**
 * AST node for a SQL `INSERT` statement.
 */
export interface TInsertStatement {
	type: "insert";
	into: TNamedTableReference;
	columns: string[];
	values?: Record<string, TReferenceOrLiteral>[];
	from?: TSelectStatement;
}

/** Zod schema for {@link TInsertStatement}. */
export const TInsertStatement = z.strictObject({
	type: z.literal("insert"),
	into: TNamedTableReference,
	columns: z.array(z.string()),
	values: z.array(z.record(z.string(), TReferenceOrLiteral)),
	from: z.optional(TSelectStatement),
}).meta({ id: "InsertStatement" });

/**
 * AST node for a SQL `UPDATE` statement.
 */
export interface TUpdateStatement {
	type: "update";
	table: TNamedTableReference;
	set: Record<string, TReferenceOrLiteral>;
	join: Array<TJoinFragment>;
	where?: TBooleanExpression<any> | TExpression;
	limit?: number;
}

/** Zod schema for {@link TUpdateStatement}. */
export const TUpdateStatement = z.strictObject({
	type: z.literal("update"),
	table: TNamedTableReference,
	set: z.record(z.string(), TReferenceOrLiteral),
	join: z.optional(z.array(TJoinFragment)),
	where: z.optional(z.union([TBooleanExpression, TExpression])),
	limit: z.optional(z.number()),
}).meta({ id: "UpdateStatement" });

/**
 * AST node for a SQL `DELETE` statement.
 */
export interface TDeleteStatement {
	type: "delete";
	table: TNamedTableReference;
	join: Array<TJoinFragment>;
	where?: TBooleanExpression<any> | TExpression;
	limit?: number;
}

/** Zod schema for {@link TDeleteStatement}. */
export const TDeleteStatement = z.strictObject({
	type: z.literal("delete"),
	table: TNamedTableReference,
	join: z.optional(z.array(TJoinFragment)),
	where: z.optional(z.union([TBooleanExpression, TExpression])),
	limit: z.optional(z.number()),
}).meta({ id: "DeleteStatement" });

/**
 * AST fragment for an `EXISTS` or `NOT EXISTS` subquery check, used inside
 * {@link TBatchStatement} to guard batch operations.
 */
export interface TCheck {
	type: "exists" | "not_exists";
	select: TSelectStatement;
}

/** Zod schema for {@link TCheck}. */
export const TCheck = z.strictObject({
	type: z.union([z.literal("exists"), z.literal("not_exists")]),
	select: TSelectStatement,
}).meta({ id: "Check" });

/**
 * AST node representing a batch of SQL statements with optional pre-condition
 * checks ({@link TCheck}). All statements are executed atomically.
 */
export interface TBatchStatement {
	type: "batch";
	checks: Array<TCheck>;
	statements: Array<TAnyStatement>;
}

/** Zod schema for {@link TBatchStatement}. */
export const TBatchStatement = z.strictObject({
	type: z.literal("batch"),
	checks: z.array(TCheck),
	get statements() {
		return z.array(TAnyStatement);
	},
}).meta({ $id: "BatchStatement" });

/** Union of all statement AST node types. */
export type TAnyStatement = TSelectStatement | TInsertStatement | TUpdateStatement | TDeleteStatement | TBatchStatement;

/** Zod schema for {@link TAnyStatement}. */
export const TAnyStatement = z.union([
	TSelectStatement,
	TInsertStatement,
	TUpdateStatement,
	TDeleteStatement,
	TBatchStatement,
]).meta({ id: "AnyStatement" });

/**
 * A wrapper that tags a {@link TAnyStatement} with the `"statement"` discriminator.
 * @template TParams Named parameter types extracted from the statement.
 * @template TOutput The expected output type when executing the statement.
 */
export interface TStatement<TParams extends {}, TOutput> {
	type: "statement";
	statement: TAnyStatement;
}

/** Zod schema for {@link TStatement}. */
export const TStatement = z.strictObject({
	type: z.literal("statement"),
	statement: TAnyStatement,
}).meta({ id: "Statement" });

/** Union of all AST fragment types (expressions, joins, statements, checks). */
export type TAnyFragment =
	| TExpression
	| TJoinFragment
	| TAnyStatement
	| TCheck;

/** Zod schema for {@link TAnyFragment}. */
export const TAnyFragment = z.union([
	TExpression,
	TJoinFragment,
	TAnyStatement,
	TCheck,
]).meta({ id: "AnyFragment" });

/**
 * Performs a deep structural equality check between two {@link TAnyFragment}
 * nodes.
 * @param node The first fragment (may be `null`/`undefined`).
 * @param other The second fragment (may be `null`/`undefined`).
 * @returns `true` when both fragments are structurally equal.
 */
export function isFragmentEquals(node: TAnyFragment | undefined | null, other: TAnyFragment | undefined | null): boolean {
	if (!node && !other) return true;
	if (!node || !other) return false;
	if (node.type === "literal" && other.type === "literal") {
		return node.data === other.data;
	}
	if (node.type === "functionref" && other.type === "functionref") {
		return node.name === other.name && node.params.length === other.params.length &&
			node.params.every((param: TReferenceOrLiteral, index: number) => isFragmentEquals(param, other.params[index]));
	}
	if (node.type === "tableref" && other.type === "tableref") {
		return node.table === other.table && node.alias === other.alias;
	}
	if (node.type === "columnref" && other.type === "columnref") {
		return node.table === other.table && node.column === other.column;
	}
	if (node.type === "paramref" && other.type === "paramref") {
		return node.param === other.param;
	}
	if (node.type === "booleanexpression" && other.type === "booleanexpression") {
		return node.operator === other.operator && node.operands.length === other.operands.length &&
			node.operands.every((operand: TBooleanComparisonExpression<any> | TBooleanExpression<any>, index: number) =>
				isFragmentEquals(operand, other.operands[index])
			);
	}
	if (node.type === "booleancomparison" && other.type === "booleancomparison") {
		return node.operator === other.operator && isFragmentEquals(node.left, other.left) && isFragmentEquals(node.right, other.right);
	}
	if (node.type === "select" && other.type === "select") {
		return node.from.table === other.from.table && node.from.alias === other.from.alias &&
			Object.keys(node.select).length === Object.keys(other.select).length &&
			Object.keys(node.select).every((key) => isFragmentEquals(node.select[key], other.select[key])) &&
			(!node.where || !other.where || isFragmentEquals(node.where, other.where)) &&
			node.groupBy.length === other.groupBy.length &&
			node.groupBy.every((group, index) => isFragmentEquals(group.column, other.groupBy[index].column)) &&
			node.orderBy.length === other.orderBy.length &&
			node.orderBy.every((order, index) =>
				isFragmentEquals(order.column, other.orderBy[index].column) && order.order === other.orderBy[index].order
			) &&
			(node.limit === other.limit || (node.limit === undefined && other.limit === undefined)) &&
			(node.offset === other.offset || (node.offset === undefined && other.offset === undefined)) &&
			node.join.length === other.join.length &&
			node.join.every((join, index) => isFragmentEquals(join, other.join[index]));
	}
	if (node.type === "insert" && other.type === "insert") {
		return node.into.table === other.into.table && node.into.alias === other.into.alias &&
			node.columns.length === other.columns.length &&
			node.columns.every((column, index) => column === other.columns[index]) &&
			(!node.values || !other.values || node.values.length === other.values.length &&
					node.values.every((value, index) =>
						Object.keys(value).length === Object.keys(other.values?.[index] ?? {}).length &&
						Object.keys(value).every((key) => isFragmentEquals(value[key], other.values?.[index]?.[key]))
					)) &&
			(!node.from || !other.from || isFragmentEquals(node.from, other.from));
	}
	if (node.type === "update" && other.type === "update") {
		return node.table.table === other.table.table && node.table.alias === other.table.alias &&
			Object.keys(node.set).length === Object.keys(other.set).length &&
			Object.keys(node.set).every((key) => isFragmentEquals(node.set[key], other.set[key])) &&
			node.join.length === other.join.length &&
			node.join.every((join, index) => isFragmentEquals(join, other.join[index])) &&
			(!node.where || !other.where || isFragmentEquals(node.where, other.where)) &&
			(node.limit === other.limit || (node.limit === undefined && other.limit === undefined));
	}
	if (node.type === "delete" && other.type === "delete") {
		return node.table.table === other.table.table && node.table.alias === other.table.alias &&
			node.join.length === other.join.length &&
			node.join.every((join, index) => isFragmentEquals(join, other.join[index])) &&
			(!node.where || !other.where || isFragmentEquals(node.where, other.where)) &&
			(node.limit === other.limit || (node.limit === undefined && other.limit === undefined));
	}
	if (node.type === "batch" && other.type === "batch") {
		return node.checks.length === other.checks.length &&
			node.checks.every((check, index) =>
				isFragmentEquals(check.select, other.checks[index].select) &&
				check.type === other.checks[index].type
			) &&
			node.statements.length === other.statements.length &&
			node.statements.every((statement, index) => isFragmentEquals(statement, other.statements[index]));
	}
	if (node.type === "join" && other.type === "join") {
		return node.table === other.table && node.alias === other.alias &&
			(!node.on || !other.on || isFragmentEquals(node.on, other.on));
	}
	if (node.type === "exists" && other.type === "exists") {
		return isFragmentEquals(node.select, other.select);
	}
	if (node.type === "not_exists" && other.type === "not_exists") {
		return isFragmentEquals(node.select, other.select);
	}
	return false;
}
