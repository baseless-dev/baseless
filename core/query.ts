import type { Prettify, TLiteral } from "./schema.ts";

export type PreparedQuery<TModel extends {}, TParams extends {}> = {
	hash: string;
};

export type QueryBuilder<
	TTables extends {},
	TFrom extends {},
	TParams extends {},
> = {
	from<TName extends keyof TTables>(table: TName): QueryBuilder<TTables, Prettify<TFrom & { [a in TName]: TTables[TName] }>, TParams>;
	from<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): QueryBuilder<TTables, Prettify<TFrom & { [a in TAlias]: TTables[TName] }>, TParams>;
	join<TName extends keyof TTables, TOnParams extends {}>(
		table: TName,
		on: (
			expr: BooleanExpressionBuilder<Prettify<TFrom & { [a in TName]: TTables[TName] }>, TParams>,
		) => BooleanComparisonExpression<TOnParams> | BooleanExpression<TOnParams>,
	): QueryBuilder<TTables, Prettify<TFrom & { [a in TName]: TTables[TName] }>, Prettify<TParams & TOnParams>>;
	join<TName extends keyof TTables, TAlias extends string, TOnParams extends {}>(
		table: TName,
		alias: TAlias,
		on: (
			expr: BooleanExpressionBuilder<Prettify<TFrom & { [a in TAlias]: TTables[TName] }>, TParams>,
		) => BooleanComparisonExpression<TOnParams> | BooleanExpression<TOnParams>,
	): QueryBuilder<TTables, Prettify<TFrom & { [a in TAlias]: TTables[TName] }>, Prettify<TParams & TOnParams>>;
	where<TWhereParams extends {}>(
		builder: (
			expr: BooleanExpressionBuilder<TFrom, TParams>,
		) => BooleanComparisonExpression<TWhereParams> | BooleanExpression<TWhereParams>,
	): QueryBuilder<TTables, TFrom, Prettify<TParams & TWhereParams>>;
	//
	select<TSelect extends Record<string, Expression>>(
		builder: (expr: ExpressionBuilder<TFrom>) => TSelect,
	): SelectQueryBuilder<TFrom, InferModelFromSelection<TSelect>, Prettify<TParams & ExtractNamedParamReference<TSelect>>>;
	//
	// select<TName extends string, TData>(
	// 	builder: (expr: ExpressionBuilder<TFrom>) => NamedColumnReference<TName, TData>,
	// ): SelectQueryBuilder<TFrom, { [a in TName]: TData }, TParams>;
	// select<TAlias extends string, TData>(
	// 	alias: TAlias,
	// 	builder: (expr: ExpressionBuilder<TFrom>) => NamedColumnReference<string, TData>,
	// ): SelectQueryBuilder<TFrom, { [a in TAlias]: TData }, TParams>;
	// select<TName extends string>(
	// 	builder: (expr: ExpressionBuilder<TFrom>) => NamedParamReference<TName>,
	// ): SelectQueryBuilder<TFrom, { [a in TName]: string }, Prettify<TParams & { [a in TName]: unknown }>>;
	// select<TAlias extends string>(
	// 	alias: TAlias,
	// 	builder: (expr: ExpressionBuilder<TFrom>) => NamedParamReference<TAlias>,
	// ): SelectQueryBuilder<TFrom, { [a in TAlias]: string }, Prettify<TParams & { [a in TAlias]: unknown }>>;
	// select<TData extends null | string | number, TAlias extends string>(
	// 	alias: TAlias,
	// 	builder: (expr: ExpressionBuilder<TFrom>) => Literal<TData>,
	// ): SelectQueryBuilder<TFrom, { [a in TAlias]: TData }, TParams>;
};

export type SelectQueryBuilder<
	TTables extends {},
	TModel extends {},
	TParams extends {},
	TSingleResult extends boolean = false,
> = {
	select<TName extends string, TData>(
		builder: (expr: ExpressionBuilder<TTables>) => NamedColumnReference<TName, TData>,
	): SelectQueryBuilder<TTables, Prettify<TModel & { [a in TName]: TData }>, TParams>;
	select<TAlias extends string, TData>(
		alias: TAlias,
		builder: (expr: ExpressionBuilder<TTables>) => NamedColumnReference<string, TData>,
	): SelectQueryBuilder<TTables, Prettify<TModel & { [a in TAlias]: TData }>, TParams>;
	select<TName extends string>(
		builder: (expr: ExpressionBuilder<TTables>) => NamedParamReference<TName>,
	): SelectQueryBuilder<TTables, { [a in TName]: string }, Prettify<TParams & { [a in TName]: unknown }>>;
	select<TAlias extends string>(
		alias: TAlias,
		builder: (expr: ExpressionBuilder<TTables>) => NamedParamReference<TAlias>,
	): SelectQueryBuilder<TTables, { [a in TAlias]: string }, Prettify<TParams & { [a in TAlias]: unknown }>>;
	select<TData extends string | number, TAlias extends string>(
		alias: TAlias,
		builder: (expr: ExpressionBuilder<TTables>) => TLiteral<TData>,
	): SelectQueryBuilder<TTables, Prettify<TModel & { [a in TAlias]: TData }>, TParams>;
	// TODO Params in order by and group by
	// orderBy<TTableName extends keyof TTables, TColumnName extends keyof TTables[TTableName]>(
	// 	builder: (expr: ExpressionBuilder<TTables>) => Expression,
	// 	order?: "ASC" | "DESC",
	// ): SelectQueryBuilder<TTables, TModel, TParams>;
	// groupBy<TTableName extends keyof TTables, TColumnName extends keyof TTables[TTableName]>(
	// 	table: TTableName,
	// 	column: TColumnName,
	// ): SelectQueryBuilder<TTables, TModel, TParams>;
	limit<TLimit extends number>(
		limit: TLimit,
	): TLimit extends 1 ? SelectQueryBuilder<TTables, TModel, TParams, true> : SelectQueryBuilder<TTables, TModel, TParams, false>;
	offset(offset: number): SelectQueryBuilder<TTables, TModel, TParams>;
	prepare(): TSingleResult extends true ? PreparedQuery<TModel, TParams> : PreparedQuery<TModel[], TParams>;
};

export type BooleanExpression<TParams extends {}> = {
	operator: string;
	operands: Array<BooleanComparisonExpression<TParams> | BooleanExpression<TParams>>;
};

export type BooleanComparisonExpression<TParams extends {}> = {
	operator: string;
	left: Expression;
	right: Expression;
};

export type Expression =
	| NamedFunctionReference<string, any, any>
	| NamedColumnReference<string, any>
	| NamedParamReference<string>
	| TLiteral<any>;

export type NamedParamReference<TName extends string | number | symbol, TData = unknown> = {
	param: TName;
};

export type NamedColumnReference<TName extends string | number | symbol, TData> = {
	table: string;
	column: TName;
};

export type NamedFunctionReference<TName extends string | number | symbol, TParams extends Expression[], TOutput> = {
	name: TName;
	params: TParams;
};

export type ExpressionBuilder<
	TTables extends {},
> = {
	literal<TData extends null | string | number | boolean>(value: TData): TLiteral<TData>;
	ref<TTableName extends keyof TTables, TColumnName extends keyof TTables[TTableName]>(
		table: TTableName,
		column: TColumnName,
	): NamedColumnReference<TColumnName, TTables[TTableName][TColumnName]>;
	param<TName extends string>(name: TName): NamedParamReference<TName>;
	concat<TParams extends Expression[]>(...params: TParams): NamedFunctionReference<"concat", TParams, string>;
	invoke<TName extends string, TParams extends Expression[], TOutput>(
		name: TName,
		params: TParams,
	): NamedFunctionReference<TName, TParams, TOutput>;
};

export type BooleanExpressionBuilder<
	TTables extends {},
	TParams extends {},
> = {
	// and(...args: WhereExpressionBuilder<TTables, TParams>[]): WhereExpressionBuilder<TTables, TParams>;
	// or(...args: WhereExpressionBuilder<TTables, TParams>[]): WhereExpressionBuilder<TTables, TParams>;
	and<TLeftParams extends {}, TRightParams extends {}>(
		left: BooleanComparisonExpression<TLeftParams>,
		right: BooleanComparisonExpression<TRightParams>,
	): BooleanComparisonExpression<Prettify<TParams & TLeftParams & TRightParams>>;
	eq<TParam extends string, TData extends null | string | number | boolean>(
		left: NamedParamReference<TParam>,
		right: NamedColumnReference<any, TData> | TLiteral<TData>,
	): BooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	eq<TParam extends string, TData extends null | string | number | boolean>(
		left: NamedColumnReference<any, TData> | TLiteral<TData>,
		right: NamedParamReference<TParam>,
	): BooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	eq<TParamLeft extends string, TParamRight extends string>(
		left: NamedParamReference<TParamLeft>,
		right: NamedParamReference<TParamRight>,
	): BooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: unknown } & { [a in TParamRight]: unknown }>>;
	eq<TDataLeft extends null | string | number | boolean, TDataRight>(
		left: NamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? NamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): BooleanComparisonExpression<{}>;
	eq<TDataLeft extends null | string | number | boolean, TDataRight extends null | string | number | boolean>(
		left: TDataLeft extends TDataRight ? NamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: NamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): BooleanComparisonExpression<{}>;
	// eq(left: Expression, right: Expression): ComparisonExpression;
	// ne(left: Expression, right: Expression): ComparisonExpression;
	// gt(left: Expression, right: Expression): ComparisonExpression;
	// gte(left: Expression, right: Expression): ComparisonExpression;
	// lt(left: Expression, right: Expression): ComparisonExpression;
	// lte(left: Expression, right: Expression): ComparisonExpression;
	// in(left: Expression, values: Literal<any>[]): ComparisonExpression;
	// nin(left: Expression, values: Literal<any>[]): ComparisonExpression;
} & ExpressionBuilder<TTables>;

// deno-fmt-ignore
export type InferModelFromSelection<T> =
	T extends NamedColumnReference<infer TName, infer TData> ? TData
	: T extends NamedFunctionReference<infer TName, infer TParams, infer TOutput> ? TOutput
	: T extends NamedParamReference<infer TName> ? unknown
	: T extends Record<string, Expression> ? { [K in keyof T]: InferModelFromSelection<T[K]> }
	: never;

// deno-fmt-ignore
type _ExtractNamedParamReference<TExpr, TOutput> =
	TExpr extends NamedParamReference<infer TName, infer TData> ? { [K in TName]: TData extends unknown ? TOutput : TData }
	// @ts-expect-error: Yeah I know, it's recursive, but it's fine
	: TExpr extends NamedFunctionReference<infer TName, infer TParams, infer TOutput> ? { [K in keyof TParams]: _ExtractNamedParamReference<TParams[K], TOutput> }[number]
	: TExpr extends Record<string, Expression> ? { [K in keyof TExpr]: _ExtractNamedParamReference<TExpr[K], unknown> }[keyof TExpr]
	: never;
export type ExtractNamedParamReference<T> = Prettify<UnionToIntersection<_ExtractNamedParamReference<T, unknown>>>;

export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never;
