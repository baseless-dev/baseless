import type {
	TAnyFragment,
	TBatchStatement,
	TBooleanComparisonExpression,
	TBooleanExpression,
	TCheck,
	TDeleteStatement,
	TInsertStatement,
	TJoinFragment,
	TLiteral,
	TNamedColumnReference,
	TNamedFunctionReference,
	TNamedParamReference,
	TNamedTableReference,
	TSelectStatement,
	TUpdateStatement,
} from "./schema.ts";

export function visit<TReturn>(
	node: TAnyFragment,
	visitor: Visitor<TReturn, void>,
): TReturn;
export function visit<TReturn, TContext>(
	node: TAnyFragment,
	visitor: Visitor<TReturn, TContext>,
	defaultContext: TContext,
): TReturn;
export function visit<TReturn, TContext>(
	node: TAnyFragment,
	visitor: Visitor<TReturn, TContext>,
	defaultContext?: TContext,
): TReturn {
	const _visit = (node: TAnyFragment, ctx: TContext): TReturn => visit<TReturn, TContext>(node, visitor, ctx);
	switch (node.type) {
		case "literal":
			return visitor.visitLiteral(node, _visit, defaultContext!);
		case "functionref":
			return visitor.visitNamedFunctionReference(node, _visit, defaultContext!);
		case "tableref":
			return visitor.visitTableReference(node, _visit, defaultContext!);
		case "columnref":
			return visitor.visitColumnReference(node, _visit, defaultContext!);
		case "paramref":
			return visitor.visitNamedParamReference(node, _visit, defaultContext!);
		case "booleanexpression":
			return visitor.visitBooleanExpression(node, _visit, defaultContext!);
		case "booleancomparison":
			return visitor.visitBooleanComparisonExpression(node, _visit, defaultContext!);
		case "select":
			return visitor.visitSelectStatement(node, _visit, defaultContext!);
		case "insert":
			return visitor.visitInsertStatement(node, _visit, defaultContext!);
		case "update":
			return visitor.visitUpdateStatement(node, _visit, defaultContext!);
		case "delete":
			return visitor.visitDeleteStatement(node, _visit, defaultContext!);
		case "batch":
			return visitor.visitBatchStatement(node, _visit, defaultContext!);
		case "join":
			return visitor.visitJoinFragment(node, _visit, defaultContext!);
		case "exists":
		case "not_exists":
			return visitor.visitCheck(node, _visit, defaultContext!);
		default:
			throw new UnknownExpressionError();
	}
}

export class UnknownExpressionError extends Error {}

export interface Visitor<TReturn, TContext> {
	visitLiteral(node: TLiteral<any>, visit: (node: TAnyFragment, ctx: TContext) => TReturn, ctx: TContext): TReturn;
	visitNamedFunctionReference(
		node: TNamedFunctionReference<any, any, any>,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitTableReference(
		node: TNamedTableReference,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitColumnReference(
		node: TNamedColumnReference<any, any>,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitNamedParamReference(
		node: TNamedParamReference<any, any>,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitBooleanExpression(
		node: TBooleanExpression<any>,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitBooleanComparisonExpression(
		node: TBooleanComparisonExpression<any>,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitSelectStatement(
		node: TSelectStatement,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitInsertStatement(
		node: TInsertStatement,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitUpdateStatement(
		node: TUpdateStatement,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitDeleteStatement(
		node: TDeleteStatement,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitBatchStatement(
		node: TBatchStatement,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitJoinFragment(
		node: TJoinFragment,
		visit: (node: TAnyFragment, ctx: TContext) => TReturn,
		ctx: TContext,
	): TReturn;
	visitCheck(node: TCheck, visit: (node: TAnyFragment, ctx: TContext) => TReturn, ctx: TContext): TReturn;
}
