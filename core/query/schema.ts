// deno-lint-ignore-file no-explicit-any ban-types
import * as z from "../schema.ts";

export interface TLiteral<TData> {
	type: "literal";
	data: TData;
}

export const TLiteral = z.strictObject({
	type: z.literal("literal"),
	data: z.any(),
}).meta({ id: "Literal" });

export interface TNamedParamReference<TName extends string | number | symbol, TData = any> {
	type: "paramref";
	param: TName;
}

export const TNamedParamReference = z.strictObject({
	type: z.literal("paramref"),
	param: z.string(),
}).meta({ id: "NamedParamReference" });

export interface TNamedTableReference {
	type: "tableref";
	table: string;
	alias?: string;
}

export const TNamedTableReference = z.strictObject({
	type: z.literal("table"),
	table: z.string(),
	alias: z.optional(z.string()),
}).meta({ id: "NamedTableReference" });

export interface TNamedColumnReference<TName extends string | number | symbol, TData> {
	type: "columnref";
	table: string;
	column: TName;
}

export const TNamedColumnReference = z.strictObject({
	type: z.literal("columnref"),
	table: z.string(),
	column: z.string(),
}).meta({ id: "NamedColumnReference" });

export interface TNamedFunctionReference<TName extends string | number | symbol, TParams extends TReferenceOrLiteral[], TOutput> {
	type: "functionref";
	name: TName;
	params: TParams;
}

export const TNamedFunctionReference = z.strictObject({
	type: z.literal("functionref"),
	name: z.string(),
	params: z.array(z.any()),
}).meta({ id: "NamedFunctionReference" });

export interface TBooleanComparisonExpression<TParams extends {}> {
	type: "booleancomparison";
	operator: string;
	left: TExpression;
	right: TExpression;
}

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

export interface TBooleanExpression<TParams extends {}> {
	type: "booleanexpression";
	operator: string;
	operands: Array<TBooleanComparisonExpression<TParams> | TBooleanExpression<TParams>>;
}

export const TBooleanExpression = z.strictObject({
	type: z.literal("booleanexpression"),
	operator: z.string(),
	get operands() {
		return z.array(z.union([TBooleanComparisonExpression, TBooleanExpression]));
	},
}).meta({ id: "BooleanExpression" });

export type TReferenceOrLiteral<TData = any> =
	| TNamedFunctionReference<string, TReferenceOrLiteral<TData>[], any>
	| TNamedTableReference
	| TNamedColumnReference<string, TData>
	| TNamedParamReference<string, TData>
	| TLiteral<TData>;

export const TReferenceOrLiteral = z.lazy(() =>
	z.union([
		TNamedFunctionReference,
		TNamedTableReference,
		TNamedColumnReference,
		TNamedParamReference,
		TLiteral,
	]).meta({ id: "ReferenceOrLiteral" })
);

export type TExpression =
	| TNamedFunctionReference<string, any, any>
	| TNamedTableReference
	| TNamedColumnReference<string, any>
	| TNamedParamReference<string>
	| TLiteral<any>
	| TBooleanExpression<any>
	| TBooleanComparisonExpression<any>;

export const TExpression = z.union([
	TNamedFunctionReference,
	TNamedTableReference,
	TNamedColumnReference,
	TNamedParamReference,
	TLiteral,
	TBooleanExpression,
	TBooleanComparisonExpression,
]).meta({ id: "Expression" });

export interface TJoinFragment {
	type: "join";
	table: string;
	alias?: string;
	on?: TBooleanComparisonExpression<any> | TBooleanExpression<any>;
}

export const TJoinFragment = z.strictObject({
	table: z.string(),
	alias: z.optional(z.string()),
	on: z.optional(z.union([TBooleanComparisonExpression, TBooleanExpression])),
}).meta({ id: "JoinFragment" });

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

export interface TInsertStatement {
	type: "insert";
	into: TNamedTableReference;
	columns: string[];
	values?: Record<string, TReferenceOrLiteral>[];
	from?: TSelectStatement;
}

export const TInsertStatement = z.strictObject({
	type: z.literal("insert"),
	into: TNamedTableReference,
	columns: z.array(z.string()),
	values: z.array(z.record(z.string(), TReferenceOrLiteral)),
	from: z.optional(TSelectStatement),
}).meta({ id: "InsertStatement" });

export interface TUpdateStatement {
	type: "update";
	table: TNamedTableReference;
	set: Record<string, TReferenceOrLiteral>;
	join: Array<TJoinFragment>;
	where?: TBooleanExpression<any> | TExpression;
	limit?: number;
}

export const TUpdateStatement = z.strictObject({
	type: z.literal("update"),
	table: TNamedTableReference,
	set: z.record(z.string(), TReferenceOrLiteral),
	join: z.optional(z.array(TJoinFragment)),
	where: z.optional(z.union([TBooleanExpression, TExpression])),
	limit: z.optional(z.number()),
}).meta({ id: "UpdateStatement" });

export interface TDeleteStatement {
	type: "delete";
	table: TNamedTableReference;
	join: Array<TJoinFragment>;
	where?: TBooleanExpression<any> | TExpression;
	limit?: number;
}

export const TDeleteStatement = z.strictObject({
	type: z.literal("delete"),
	table: TNamedTableReference,
	join: z.optional(z.array(TJoinFragment)),
	where: z.optional(z.union([TBooleanExpression, TExpression])),
	limit: z.optional(z.number()),
}).meta({ id: "DeleteStatement" });

export interface TCheck {
	type: "exists" | "not_exists";
	select: TSelectStatement;
}

export const TCheck = z.strictObject({
	type: z.union([z.literal("exists"), z.literal("not_exists")]),
	select: TSelectStatement,
}).meta({ id: "Check" });

export interface TBatchStatement {
	type: "batch";
	checks: Array<TCheck>;
	statements: Array<TAnyStatement>;
}

export const TBatchStatement = z.strictObject({
	type: z.literal("batch"),
	checks: z.array(TCheck),
	get statements() {
		return z.array(TAnyStatement);
	},
}).meta({ $id: "BatchStatement" });

export type TAnyStatement = TSelectStatement | TInsertStatement | TUpdateStatement | TDeleteStatement | TBatchStatement;

export const TAnyStatement = z.union([
	TSelectStatement,
	TInsertStatement,
	TUpdateStatement,
	TDeleteStatement,
	TBatchStatement,
]).meta({ id: "AnyStatement" });

export interface TStatement<TParams extends {}, TOutput> {
	type: "statement";
	statement: TAnyStatement;
}

export const TStatement = z.strictObject({
	type: z.literal("statement"),
	statement: TAnyStatement,
}).meta({ id: "Statement" });

export type TAnyFragment =
	| TExpression
	| TJoinFragment
	| TAnyStatement
	| TCheck;

export const TAnyFragment = z.union([
	TExpression,
	TJoinFragment,
	TAnyStatement,
	TCheck,
]).meta({ id: "AnyFragment" });

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
