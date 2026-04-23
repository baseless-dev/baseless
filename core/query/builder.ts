// deno-lint-ignore-file no-explicit-any ban-types
import type {
	TAnyStatement,
	TBatchStatement,
	TBooleanComparisonExpression,
	TBooleanExpression,
	TCheck,
	TDeleteStatement,
	TInsertStatement,
	TLiteral,
	TNamedColumnReference,
	TNamedFunctionReference,
	TNamedParamReference,
	TNamedTableReference,
	TReferenceOrLiteral,
	TSelectStatement,
	TStatement,
	TSubqueryExpression,
	TUpdateStatement,
} from "./schema.ts";
import type { Prettify } from "../prettify.ts";

// deno-fmt-ignore
type Flatten<T> = {
	[DK in {[K in keyof T & string]: `${K}.${keyof T[K] & string}`;}[keyof T & string]]: DK extends `${infer K}.${infer F}`
		? K extends keyof T
			? F extends keyof T[K]
				? T[K][F]
				: never
			: never
		: never;
};

type LastIdentifier<T extends string> = T extends `${infer _}.${infer Rest}` ? LastIdentifier<Rest> : T;

type SelectableExpression = TReferenceOrLiteral | TSubqueryExpression;
type PredicateExpression = TBooleanComparisonExpression<any> | TBooleanExpression<any>;

// deno-fmt-ignore
type ColumnsToOutput<TFrom, TColumns extends any[]> =
	Prettify<
		{ [P in TColumns[number] as P extends (keyof Flatten<TFrom>) ? LastIdentifier<P> : never]: Flatten<TFrom>[P]; }
		& { [P in TColumns[number] as P extends IdentifierExpression<any, infer A> ? A & string : never]: P extends IdentifierExpression<infer T, any> ? T : unknown; }
		& { [P in TColumns[number] as P extends LiteralExpression<any, infer A> ? A & string : never]: P extends LiteralExpression<infer T, any> ? T : unknown; }
		& { [P in TColumns[number] as P extends ParameterExpression<any, infer A, any> ? A & string : never]: P extends ParameterExpression<infer T, any, any> ? T : unknown; }
		& { [P in TColumns[number] as P extends SubqueryExpression<any, infer A, any> ? A & string : never]: P extends SubqueryExpression<infer T, any, any> ? T : unknown; }
		& { [P in TColumns[number] as P extends FunctionExpression<any, infer A, any> ? A & string : never]: P extends FunctionExpression<infer T, any, any> ? T : unknown; }
	>;

export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never;

type WritableValueExpression =
	| Expression<any, any, any>
	| TReferenceOrLiteral
	| TSubqueryExpression
	| null
	| string
	| number
	| boolean
	| Date;

// deno-fmt-ignore
type InferModelFromWritableValue<T> =
	T extends IdentifierExpression<infer TData, any> ? TData
	: T extends LiteralExpression<infer TData, any> ? TData
	: T extends ParameterExpression<infer TData, any, any> ? TData
	: T extends SubqueryExpression<infer TData, any, any> ? TData
	: T extends FunctionExpression<infer TData, any, any> ? TData
	: T extends TNamedColumnReference<any, infer TData> ? TData
	: T extends TNamedFunctionReference<any, any, infer TData> ? TData
	: T extends TNamedParamReference<any, infer TData> ? TData
	: T extends TLiteral<infer TData> ? TData
	: T extends null | string | number | boolean | Date ? T
	: T extends Record<string, WritableValueExpression> ? { [K in keyof T]: InferModelFromWritableValue<T[K]> }
	: never;

// deno-fmt-ignore
type _ExtractParamsFromWritableValue<TExpr, M extends any[]> =
	M["length"] extends 8 ? never
	: TExpr extends ParameterExpression<any, any, infer TParams> ? TParams
	: TExpr extends SubqueryExpression<any, any, infer TParams> ? TParams
	: TExpr extends FunctionExpression<any, any, infer TParams> ? TParams
	: TExpr extends TNamedParamReference<infer TName, infer TData> ? { [K in TName & string]: TData }
	: TExpr extends TNamedFunctionReference<any, infer TParams, any> ? { [K in keyof TParams]: _ExtractParamsFromWritableValue<TParams[K], [1, ...M]> }[number]
	: TExpr extends TNamedColumnReference<any, any> ? never
	: TExpr extends TLiteral<any> ? never
	: TExpr extends TSubqueryExpression ? never
	: TExpr extends Array<infer TItem> ? _ExtractParamsFromWritableValue<TItem, [1, ...M]>
	: TExpr extends Record<string, WritableValueExpression> ? { [K in keyof TExpr]: _ExtractParamsFromWritableValue<TExpr[K], [1, ...M]> }[keyof TExpr]
	: never;

export type ExtractParamsFromWritableValue<T> = Prettify<UnionToIntersection<_ExtractParamsFromWritableValue<T, []>>>;

export interface IStatementBuilder<TParams extends {}, TOutput> {
	build(): TAnyStatement;
	toStatement(): TStatement<TParams, TOutput>;
	toJSON(): TAnyStatement;
}

interface ISelectFromQueryRoot<TTables extends {}> {
	selectFrom<TName extends keyof TTables>(table: TName): SelectQueryBuilder<TTables, { [K in TName]: TTables[K] }, {}, false, {}>;
	selectFrom<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): SelectQueryBuilder<TTables, { [K in TAlias]: TTables[TName] }, {}, false, {}>;
}

export class RootQueryBuilder<TTables extends {}, TInsertTables extends {} = TTables> {
	selectFrom<TName extends keyof TTables>(table: TName): SelectQueryBuilder<TTables, { [K in TName]: TTables[K] }, {}, false, {}>;
	selectFrom<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): SelectQueryBuilder<TTables, { [K in TAlias]: TTables[TName] }, {}, false, {}>;
	selectFrom(table: string, alias?: string): SelectQueryBuilder<any, any, any, false, {}> {
		return new SelectQueryBuilder(
			{ type: "tableref", table, alias },
			[],
			{},
			undefined,
			undefined,
			[],
			[],
			undefined,
			undefined,
		);
	}
	insertInto<TName extends keyof TInsertTables>(
		table: TName,
	): InsertQueryBuilder<TTables, TInsertTables, { [K in TName]: TInsertTables[TName] }, TInsertTables[TName], {}>;
	insertInto<TName extends keyof TInsertTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): InsertQueryBuilder<TTables, TInsertTables, { [K in TAlias]: TInsertTables[TName] }, TInsertTables[TName], {}>;
	insertInto(table: string, alias?: string): InsertQueryBuilder<any, any, any, any, {}> {
		return new InsertQueryBuilder(
			{ type: "tableref", table, alias },
			[],
			undefined,
			undefined,
		);
	}
	updateFrom<TName extends keyof TTables>(
		table: TName,
	): UpdateQueryBuilder<TTables, { [K in TName]: TTables[TName] }, TTables[TName], {}>;
	updateFrom<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): UpdateQueryBuilder<TTables, { [K in TAlias]: TTables[TName] }, TTables[TName], {}>;
	updateFrom(table: string, alias?: string): UpdateQueryBuilder<any, any, any, {}> {
		return new UpdateQueryBuilder(
			{ type: "tableref", table, alias },
			undefined,
			[],
			undefined,
			undefined,
		);
	}
	deleteFrom<TName extends keyof TTables>(table: TName): DeleteQueryBuilder<TTables, { [K in TName]: TTables[TName] }, {}>;
	deleteFrom<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): DeleteQueryBuilder<TTables, { [K in TAlias]: TTables[TName] }, {}>;
	deleteFrom(table: string, alias?: string): DeleteQueryBuilder<any, any, {}> {
		return new DeleteQueryBuilder(
			{ type: "tableref", table, alias },
			[],
			undefined,
			undefined,
		);
	}
	batch(): BatchQueryBuilder<TTables, TInsertTables, {}> {
		return new BatchQueryBuilder([], []);
	}
}

export class IdentifierExpression<TOutput, TAlias> {
	#kind!: "identifier";
	#column: TNamedColumnReference<string, TOutput>;
	#alias?: string;
	#order?: "ASC" | "DESC";

	constructor(column: TNamedColumnReference<string, TOutput>, alias?: string, order?: "ASC" | "DESC") {
		this.#column = column;
		this.#alias = alias;
		this.#order = order;
	}

	as<TNewAlias extends string>(alias: TNewAlias): IdentifierExpression<TOutput, TNewAlias> {
		return new IdentifierExpression(this.#column, alias, this.#order);
	}
	asc(): IdentifierExpression<TOutput, TAlias> {
		return new IdentifierExpression(this.#column, this.#alias, "ASC");
	}
	desc(): IdentifierExpression<TOutput, TAlias> {
		return new IdentifierExpression(this.#column, this.#alias, "DESC");
	}
	toJSON(): TNamedColumnReference<string, TOutput> {
		return this.#column;
	}
	get alias(): string | undefined {
		return this.#alias;
	}
	get order(): "ASC" | "DESC" | undefined {
		return this.#order;
	}
}

export class LiteralExpression<TOutput, TAlias> {
	#kind!: "literal";
	#literal: TLiteral<TOutput>;
	#alias?: string;

	constructor(literal: TLiteral<TOutput>, alias?: string) {
		this.#literal = literal;
		this.#alias = alias;
	}

	as<TNewAlias extends string>(alias: TNewAlias): LiteralExpression<TOutput, TNewAlias> {
		return new LiteralExpression(this.#literal, alias);
	}
	toJSON(): TLiteral<TOutput> {
		return this.#literal;
	}
	get alias(): string | undefined {
		return this.#alias;
	}
}

export class ParameterExpression<TOutput, TName, TParams> {
	#kind!: "parameter";
	#param: TNamedParamReference<string, TOutput>;
	#alias?: string;

	constructor(name: string, alias?: string) {
		this.#param = { type: "paramref", param: name };
		this.#alias = alias;
	}
	as<TNewOutput>(): ParameterExpression<TNewOutput, TName, { [N in TName & string]: TNewOutput }>;
	as<TNewAlias extends string>(alias: TNewAlias): ParameterExpression<TOutput, TNewAlias, TParams>;
	as(alias?: string): ParameterExpression<any, any, any> {
		if (typeof alias === "string") {
			return new ParameterExpression(this.#param.param, alias);
		}
		return new ParameterExpression(this.#param.param, this.#alias);
	}
	toJSON(): TNamedParamReference<string, TOutput> {
		return this.#param;
	}
	get name(): string {
		return this.#param.param;
	}
	get alias(): string | undefined {
		return this.#alias;
	}
}

export class SubqueryExpression<TOutput, TAlias, TParams> {
	#kind!: "subquery";
	#subquery: TSubqueryExpression;
	#alias?: string;

	constructor(select: TSelectStatement, alias?: string) {
		this.#subquery = { type: "subquery", select };
		this.#alias = alias;
	}

	as<TNewAlias extends string>(alias: TNewAlias): SubqueryExpression<TOutput, TNewAlias, TParams> {
		return new SubqueryExpression(this.#subquery.select, alias);
	}
	toJSON(): TSubqueryExpression {
		return this.#subquery;
	}
	get alias(): string | undefined {
		return this.#alias;
	}
}

export class FunctionExpression<TOutput, TAlias, TParams> {
	#kind!: "function";
	#fn: TNamedFunctionReference<string, TReferenceOrLiteral[], TOutput>;
	#alias?: string;

	constructor(name: string, params: TReferenceOrLiteral[], alias?: string) {
		this.#fn = { type: "functionref", name, params };
		this.#alias = alias;
	}
	as<TNewAlias extends string>(alias: TNewAlias): FunctionExpression<TOutput, TNewAlias, TParams> {
		return new FunctionExpression(this.#fn.name, this.#fn.params, alias);
	}
	toJSON(): TNamedFunctionReference<string, TReferenceOrLiteral[], TOutput> {
		return this.#fn;
	}
	get alias(): string | undefined {
		return this.#alias;
	}
}

export type Expression<TOutput, TAlias, TParams> =
	| IdentifierExpression<TOutput, TAlias>
	| LiteralExpression<TOutput, TAlias>
	| ParameterExpression<TOutput, TAlias, TParams>
	| SubqueryExpression<TOutput, TAlias, TParams>
	| FunctionExpression<TOutput, TAlias, TParams>;

export class ExpressionBuilder<TTables extends {} = {}, TFrom extends {} = {}, TOutput = never, TParams extends {} = {}> {
	literal<TLiteral extends string | number | boolean | Date | null>(value: TLiteral): LiteralExpression<TLiteral, never> {
		return new LiteralExpression({ type: "literal", data: value });
	}
	ref<TTable extends keyof TTables & string, TColumn extends keyof TTables[TTable] & string>(
		table: TTable,
		column: TColumn,
	): IdentifierExpression<TTables[TTable][TColumn], TColumn> {
		return new IdentifierExpression(parseIdentifier(`${table}.${column}`));
	}
	column<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
	): IdentifierExpression<Flatten<TFrom>[TIdentifier], LastIdentifier<TIdentifier>> {
		return new IdentifierExpression(parseIdentifier(column as string));
	}
	param<TName extends string, TValue>(name: TName): ParameterExpression<TValue, TName, { [N in TName]: TValue }> {
		return new ParameterExpression(name);
	}
	select<TSelectOutput, TNewParams extends {}>(
		builder: (q: ISelectFromQueryRoot<TTables>) => SelectQueryBuilder<TTables, any, TSelectOutput, any, TNewParams>,
	): SubqueryExpression<TSelectOutput, never, TNewParams> {
		return new SubqueryExpression(builder(new RootQueryBuilder<TTables>()).build());
	}
	fn<TReturn, TNewParams>(name: string, ...args: Expression<any, never, TNewParams>[]): FunctionExpression<TReturn, never, TNewParams> {
		return new FunctionExpression<TReturn, never, TNewParams>(name, args.map((arg) => serializeSelectable(arg)) as TReferenceOrLiteral[]);
	}
	equal<TValue, TLeftParams, TRightParams>(
		left: Expression<TValue, any, TLeftParams>,
		right: Expression<TValue, any, TRightParams>,
	): TBooleanComparisonExpression<Prettify<TLeftParams & TRightParams>> {
		return {
			type: "booleancomparison",
			operator: "eq",
			left: serializeExpressionOperand(left),
			right: serializeExpressionOperand(right),
		};
	}
}

export class SelectQueryBuilder<TTables extends {}, TFrom extends {}, TOutput, TSingle, TParams extends {}> {
	#from: TNamedTableReference;
	#join: TSelectStatement["join"];
	#select: TSelectStatement["select"];
	#where?: TSelectStatement["where"];
	#having?: TSelectStatement["having"];
	#groupBy: TSelectStatement["groupBy"];
	#orderBy: TSelectStatement["orderBy"];
	#limit?: TSelectStatement["limit"];
	#offset?: TSelectStatement["offset"];

	constructor(
		from: TNamedTableReference,
		join: TSelectStatement["join"],
		select: TSelectStatement["select"],
		where: TSelectStatement["where"],
		having: TSelectStatement["having"],
		groupBy: TSelectStatement["groupBy"],
		orderBy: TSelectStatement["orderBy"],
		limit: TSelectStatement["limit"],
		offset: TSelectStatement["offset"],
	) {
		this.#from = from;
		this.#join = join;
		this.#select = select;
		this.#where = where;
		this.#having = having;
		this.#groupBy = groupBy;
		this.#orderBy = orderBy;
		this.#limit = limit;
		this.#offset = offset;
	}

	build(): TSelectStatement {
		return {
			type: "select",
			from: this.#from,
			join: this.#join,
			select: this.#select,
			where: this.#where,
			having: this.#having,
			groupBy: this.#groupBy,
			orderBy: this.#orderBy,
			limit: this.#limit,
			offset: this.#offset,
		};
	}

	toStatement(): TStatement<TParams, TSingle extends true ? TOutput : TOutput[]> {
		return {
			type: "statement",
			statement: this.build(),
		};
	}

	toJSON(): TSelectStatement {
		return this.build();
	}

	select<const TColumns extends Array<keyof Flatten<TFrom>>>(
		columns: TColumns,
	): SelectQueryBuilder<
		TTables,
		TFrom,
		Prettify<
			& TOutput
			& ColumnsToOutput<TFrom, TColumns>
		>,
		TSingle,
		TParams
	>;
	select<const TColumns extends Array<(keyof Flatten<TFrom>) | Expression<any, any, any>>>(
		builder: (q: ExpressionBuilder<TTables, TFrom, any, any>) => TColumns,
	): SelectQueryBuilder<
		TTables,
		TFrom,
		Prettify<
			& TOutput
			& ColumnsToOutput<TFrom, TColumns>
		>,
		TSingle,
		Prettify<TParams & ExtractParamsFromWritableValue<TColumns>>
	>;
	select(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		const columns = typeof args[0] === "function" ? args[0](new ExpressionBuilder<TTables, TFrom, any, any>()) : args[0];
		return new SelectQueryBuilder(
			this.#from,
			this.#join,
			{ ...this.#select, ...buildSelectMap(columns) },
			this.#where,
			this.#having,
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}
	leftJoin<TName extends keyof TTables, TNewParams>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& ExpressionBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	leftJoin<TName extends keyof TTables, TAlias extends string, TNewParams>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>
				& ExpressionBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	leftJoin(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return this.#joinTable("left", args[0], args[1], args[2]);
	}
	rightJoin<TName extends keyof TTables, TNewParams>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& ExpressionBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	rightJoin<TName extends keyof TTables, TAlias extends string, TNewParams>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>
				& ExpressionBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	rightJoin(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return this.#joinTable("right", args[0], args[1], args[2]);
	}
	innerJoin<TName extends keyof TTables, TNewParams>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& ExpressionBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	innerJoin<TName extends keyof TTables, TAlias extends string, TNewParams>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>
				& ExpressionBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	innerJoin(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return this.#joinTable("inner", args[0], args[1], args[2]);
	}
	where<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
		op: BinaryOperator,
		value: Flatten<TFrom>[TIdentifier],
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams>;
	where<TNewParams>(
		builder: (
			q:
				& BinaryExpressionBuilder<TFrom, TParams>
				& BooleanExpressionBuilder<TFrom, TParams>
				& ExpressionBuilder<TTables, TFrom, any, TParams>,
		) => BinaryExpressionBuilder<TFrom, TNewParams> | BooleanExpressionBuilder<TFrom, TNewParams>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	where(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder(
			this.#from,
			this.#join,
			this.#select,
			buildPredicate(args, () => createQueryExpressionBuilder<TTables, TFrom, TParams>()),
			this.#having,
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}
	groupBy(columns: Array<keyof Flatten<TFrom>>): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams> {
		return new SelectQueryBuilder(
			this.#from,
			this.#join,
			this.#select,
			this.#where,
			this.#having,
			[
				...this.#groupBy,
				...columns.map((column) => ({ column: parseIdentifier(column as string) as TReferenceOrLiteral })),
			],
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}
	having<TIdentifier extends keyof Flatten<{ "": TOutput }>>(
		column: TIdentifier,
		op: BinaryOperator,
		value: Flatten<{ "": TOutput }>[TIdentifier],
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams>;
	having<TNewParams>(
		builder: (
			q:
				& BinaryExpressionBuilder<{ "": TOutput }, TParams>
				& BooleanExpressionBuilder<{ "": TOutput }, TParams>
				& ExpressionBuilder<TTables, { "": TOutput }, any, TParams>,
		) => BinaryExpressionBuilder<{ "": TOutput }, TNewParams> | BooleanExpressionBuilder<{ "": TOutput }, TNewParams>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	having(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder(
			this.#from,
			this.#join,
			this.#select,
			this.#where,
			buildPredicate(args, () => createQueryExpressionBuilder<TTables, { "": TOutput }, TParams>()),
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}
	orderBy(columns: Array<keyof Flatten<TFrom>>): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams>;
	orderBy<TNewParams>(
		builder: (q: ExpressionBuilder<TTables, TFrom, any, TParams>) => Array<(keyof Flatten<TFrom>) | Expression<any, any, any>>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	orderBy(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		const items = typeof args[0] === "function" ? args[0](new ExpressionBuilder<TTables, TFrom, any, any>()) : args[0];
		return new SelectQueryBuilder(
			this.#from,
			this.#join,
			this.#select,
			this.#where,
			this.#having,
			this.#groupBy,
			[...this.#orderBy, ...buildOrderBy(items)],
			this.#limit,
			this.#offset,
		);
	}
	limit<const TLimit extends number>(limit: TLimit): SelectQueryBuilder<TTables, TFrom, TOutput, TLimit extends 1 ? true : false, TParams> {
		return new SelectQueryBuilder(
			this.#from,
			this.#join,
			this.#select,
			this.#where,
			this.#having,
			this.#groupBy,
			this.#orderBy,
			limit,
			this.#offset,
		);
	}

	offset(offset: number): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams> {
		return new SelectQueryBuilder(
			this.#from,
			this.#join,
			this.#select,
			this.#where,
			this.#having,
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			offset,
		);
	}

	#joinTable(
		kind: "inner" | "left" | "right",
		table: string,
		aliasOrOn: unknown,
		maybeOn?: unknown,
	): SelectQueryBuilder<any, any, any, any, any> {
		const alias = typeof aliasOrOn === "string" ? aliasOrOn : undefined;
		const on = (typeof aliasOrOn === "function" ? aliasOrOn : maybeOn) as
			| ((q: QueryExpressionBuilder<any, any, any>) => BinaryExpressionBuilder<any, any> | BooleanExpressionBuilder<any, any>)
			| undefined;
		return new SelectQueryBuilder(
			this.#from,
			[
				...this.#join,
				{
					type: "join",
					joinType: kind,
					table,
					alias,
					on: on?.(createQueryExpressionBuilder<TTables, any, TParams>()).toJSON(),
				},
			],
			this.#select,
			this.#where,
			this.#having,
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}
}

export class InsertQueryBuilder<
	TTables extends {},
	TInsertTables extends {},
	TFrom extends {},
	TModel,
	TParams extends {},
> implements IStatementBuilder<TParams, void> {
	#into: TInsertStatement["into"];
	#columns: TInsertStatement["columns"];
	#values?: TInsertStatement["values"];
	#from?: TInsertStatement["from"];

	constructor(
		into: TInsertStatement["into"],
		columns: TInsertStatement["columns"],
		values?: TInsertStatement["values"],
		from?: TInsertStatement["from"],
	) {
		this.#into = into;
		this.#columns = columns;
		this.#values = values;
		this.#from = from;
	}

	build(): TInsertStatement {
		return {
			type: "insert",
			into: this.#into,
			columns: this.#columns,
			values: this.#values,
			from: this.#from,
		};
	}

	toStatement(): TStatement<TParams, void> {
		return {
			type: "statement",
			statement: this.build(),
		};
	}

	toJSON(): TInsertStatement {
		return this.build();
	}

	columns<TColumns extends Array<keyof TModel>>(
		...columns: TColumns
	): InsertQueryBuilder<TTables, TInsertTables, TFrom, TModel, Prettify<TParams & { [K in TColumns[number]]: TModel[K] }>> {
		return new InsertQueryBuilder(
			this.#into,
			[...this.#columns, ...columns as string[]],
			this.#values,
			this.#from,
		);
	}

	values<TValues extends Record<string, WritableValueExpression>>(
		builder: (
			expr: ExpressionBuilder<TTables, TFrom, any, TParams>,
		) => InferModelFromWritableValue<TValues> extends TModel ? TValues
			: [InferModelFromWritableValue<TValues>, "should extends", TModel],
	): InsertQueryBuilder<TTables, TInsertTables, TFrom, TModel, Prettify<TParams & ExtractParamsFromWritableValue<TValues>>> {
		const values = serializeWritableRecord(builder(new ExpressionBuilder<TTables, TFrom, any, TParams>()) as TValues);
		return new InsertQueryBuilder(
			this.#into,
			this.#columns,
			[...(this.#values ?? []), values],
			undefined,
		);
	}

	from<TSelectOutput, TSelectParams extends {}>(
		builder: (
			q: RootQueryBuilder<TTables, TInsertTables>,
		) => TSelectOutput extends TModel ? SelectQueryBuilder<TTables, any, TSelectOutput, any, TSelectParams>
			: [TSelectOutput, "should extends", TModel],
	): InsertQueryBuilder<TTables, TInsertTables, TFrom, TModel, Prettify<TParams & TSelectParams>> {
		return new InsertQueryBuilder(
			this.#into,
			this.#columns,
			undefined,
			(builder(new RootQueryBuilder<TTables, TInsertTables>()) as SelectQueryBuilder<any, any, any, any, any>).build(),
		);
	}
}

export class UpdateQueryBuilder<
	TTables extends {},
	TFrom extends {},
	TModel,
	TParams extends {},
> implements IStatementBuilder<TParams, void> {
	#table: TUpdateStatement["table"];
	#set?: TUpdateStatement["set"];
	#join: TUpdateStatement["join"];
	#where?: TUpdateStatement["where"];
	#limit?: TUpdateStatement["limit"];

	constructor(
		table: TUpdateStatement["table"],
		set: TUpdateStatement["set"] | undefined,
		join: TUpdateStatement["join"],
		where: TUpdateStatement["where"],
		limit: TUpdateStatement["limit"],
	) {
		this.#table = table;
		this.#set = set;
		this.#join = join;
		this.#where = where;
		this.#limit = limit;
	}

	build(): TUpdateStatement {
		return {
			type: "update",
			table: this.#table,
			set: this.#set ?? {},
			join: this.#join,
			where: this.#where,
			limit: this.#limit,
		};
	}

	toStatement(): TStatement<TParams, void> {
		return {
			type: "statement",
			statement: this.build(),
		};
	}

	toJSON(): TUpdateStatement {
		return this.build();
	}

	set<TValues extends Record<string, WritableValueExpression>>(
		builder: (
			expr: ExpressionBuilder<TTables, TFrom, any, TParams>,
		) => InferModelFromWritableValue<TValues> extends Partial<TModel> ? TValues
			: [InferModelFromWritableValue<TValues>, "should extends", Partial<TModel>],
	): UpdateQueryBuilder<TTables, TFrom, TModel, Prettify<TParams & ExtractParamsFromWritableValue<TValues>>> {
		return new UpdateQueryBuilder(
			this.#table,
			serializeWritableRecord(builder(new ExpressionBuilder<TTables, TFrom, any, TParams>()) as TValues),
			this.#join,
			this.#where,
			this.#limit,
		);
	}

	join<TName extends keyof TTables, TOnParams extends {}>(
		table: TName,
		on: (
			expr: QueryExpressionBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOnParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOnParams>,
	): UpdateQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TModel, Prettify<TParams & TOnParams>>;
	join<TName extends keyof TTables, TAlias extends string, TOnParams extends {}>(
		table: TName,
		alias: TAlias,
		on: (
			expr: QueryExpressionBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOnParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOnParams>,
	): UpdateQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TModel, Prettify<TParams & TOnParams>>;
	join(table: any, aliasOrOn: any, maybeOn?: any): UpdateQueryBuilder<any, any, any, any> {
		const alias = typeof aliasOrOn === "string" ? aliasOrOn : undefined;
		const on = (typeof aliasOrOn === "function" ? aliasOrOn : maybeOn) as
			| ((expr: QueryExpressionBuilder<any, any, any>) => BinaryExpressionBuilder<any, any> | BooleanExpressionBuilder<any, any>)
			| undefined;
		return new UpdateQueryBuilder(
			this.#table,
			this.#set,
			[
				...this.#join,
				{ type: "join", table, alias, on: on?.(createQueryExpressionBuilder<TTables, any, TParams>()).toJSON() },
			],
			this.#where,
			this.#limit,
		);
	}

	where<TWhereParams extends {}>(
		builder: (
			expr: QueryExpressionBuilder<TTables, TFrom, TParams>,
		) => BinaryExpressionBuilder<TFrom, TWhereParams> | BooleanExpressionBuilder<TFrom, TWhereParams>,
	): UpdateQueryBuilder<TTables, TFrom, TModel, Prettify<TParams & TWhereParams>> {
		return new UpdateQueryBuilder(
			this.#table,
			this.#set,
			this.#join,
			builder(createQueryExpressionBuilder<TTables, TFrom, TParams>()).toJSON(),
			this.#limit,
		);
	}

	limit(limit: number): UpdateQueryBuilder<TTables, TFrom, TModel, TParams> {
		return new UpdateQueryBuilder(
			this.#table,
			this.#set,
			this.#join,
			this.#where,
			limit,
		);
	}
}

export class DeleteQueryBuilder<
	TTables extends {},
	TFrom extends {},
	TParams extends {},
> implements IStatementBuilder<TParams, void> {
	#table: TDeleteStatement["table"];
	#join: TDeleteStatement["join"];
	#where?: TDeleteStatement["where"];
	#limit?: TDeleteStatement["limit"];

	constructor(
		table: TDeleteStatement["table"],
		join: TDeleteStatement["join"],
		where?: TDeleteStatement["where"],
		limit?: TDeleteStatement["limit"],
	) {
		this.#table = table;
		this.#join = join;
		this.#where = where;
		this.#limit = limit;
	}

	build(): TDeleteStatement {
		return {
			type: "delete",
			table: this.#table,
			join: this.#join,
			where: this.#where,
			limit: this.#limit,
		};
	}

	toStatement(): TStatement<TParams, void> {
		return {
			type: "statement",
			statement: this.build(),
		};
	}

	toJSON(): TDeleteStatement {
		return this.build();
	}

	join<TName extends keyof TTables, TOnParams extends {}>(
		table: TName,
		on: (
			expr: QueryExpressionBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOnParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOnParams>,
	): DeleteQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, Prettify<TParams & TOnParams>>;
	join<TName extends keyof TTables, TAlias extends string, TOnParams extends {}>(
		table: TName,
		alias: TAlias,
		on: (
			expr: QueryExpressionBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOnParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOnParams>,
	): DeleteQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, Prettify<TParams & TOnParams>>;
	join(table: any, aliasOrOn: any, maybeOn?: any): DeleteQueryBuilder<any, any, any> {
		const alias = typeof aliasOrOn === "string" ? aliasOrOn : undefined;
		const on = (typeof aliasOrOn === "function" ? aliasOrOn : maybeOn) as
			| ((expr: QueryExpressionBuilder<any, any, any>) => BinaryExpressionBuilder<any, any> | BooleanExpressionBuilder<any, any>)
			| undefined;
		return new DeleteQueryBuilder(
			this.#table,
			[
				...this.#join,
				{ type: "join", table, alias, on: on?.(createQueryExpressionBuilder<TTables, any, TParams>()).toJSON() },
			],
			this.#where,
			this.#limit,
		);
	}

	where<TWhereParams extends {}>(
		builder: (
			expr: QueryExpressionBuilder<TTables, TFrom, TParams>,
		) => BinaryExpressionBuilder<TFrom, TWhereParams> | BooleanExpressionBuilder<TFrom, TWhereParams>,
	): DeleteQueryBuilder<TTables, TFrom, Prettify<TParams & TWhereParams>> {
		return new DeleteQueryBuilder(
			this.#table,
			this.#join,
			builder(createQueryExpressionBuilder<TTables, TFrom, TParams>()).toJSON(),
			this.#limit,
		);
	}

	limit(limit: number): DeleteQueryBuilder<TTables, TFrom, TParams> {
		return new DeleteQueryBuilder(
			this.#table,
			this.#join,
			this.#where,
			limit,
		);
	}
}

export class BatchQueryBuilder<TTables extends {}, TInsertTables extends {}, TParams extends {}>
	extends RootQueryBuilder<TTables, TInsertTables>
	implements IStatementBuilder<TParams, void> {
	#statements: TAnyStatement[];
	#checks: TCheck[];

	constructor(statements: TAnyStatement[], checks: TCheck[]) {
		super();
		this.#statements = statements;
		this.#checks = checks;
	}

	build(): TBatchStatement {
		return {
			type: "batch",
			checks: [...this.#checks],
			statements: [...this.#statements],
		};
	}

	toStatement(): TStatement<TParams, void> {
		return {
			type: "statement",
			statement: this.build(),
		};
	}

	toJSON(): TBatchStatement {
		return this.build();
	}

	execute<TOtherParams extends {}>(
		statement:
			| InsertQueryBuilder<TTables, TInsertTables, any, any, TOtherParams>
			| UpdateQueryBuilder<TTables, any, any, TOtherParams>
			| DeleteQueryBuilder<TTables, any, TOtherParams>,
	): BatchQueryBuilder<TTables, TInsertTables, Prettify<TParams & TOtherParams>> {
		return new BatchQueryBuilder(
			[...this.#statements, statement.build()],
			this.#checks,
		);
	}

	checkIfExists<TSelectParams extends {}>(
		statement: SelectQueryBuilder<TTables, any, any, any, TSelectParams>,
	): BatchQueryBuilder<TTables, TInsertTables, Prettify<TParams & TSelectParams>> {
		return new BatchQueryBuilder(
			this.#statements,
			[...this.#checks, { type: "exists", select: statement.build() }],
		);
	}

	checkIfNotExists<TSelectParams extends {}>(
		statement: SelectQueryBuilder<TTables, any, any, any, TSelectParams>,
	): BatchQueryBuilder<TTables, TInsertTables, Prettify<TParams & TSelectParams>> {
		return new BatchQueryBuilder(
			this.#statements,
			[...this.#checks, { type: "not_exists", select: statement.build() }],
		);
	}
}

type BinaryOperator = "=" | "!=" | "<>" | ">" | ">=" | "<" | "<=" | "in" | "notIn" | "like" | "notLike";

export class BinaryExpressionBuilder<TTables extends {}, TParams> {
	#node?: TBooleanComparisonExpression<any>;

	constructor(node?: TBooleanComparisonExpression<any>) {
		this.#node = node;
	}

	toJSON(): TBooleanComparisonExpression<any> {
		if (!this.#node) {
			throw new Error("Cannot serialize an empty binary expression.");
		}
		return this.#node;
	}

	eq<TLeftIdentifier extends keyof Flatten<TTables>, TRightIdentifier extends keyof Flatten<TTables>>(
		left: TLeftIdentifier,
		right: Flatten<TTables>[TRightIdentifier] extends Flatten<TTables>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TTables, TParams>;
	eq<TIdentifier extends keyof Flatten<TTables>, TParameter>(
		column: TIdentifier,
		expr: ParameterExpression<Flatten<TTables>[TIdentifier], TParameter, any>,
	): BinaryExpressionBuilder<TTables, Prettify<TParams & { [N in TParameter & string]: Flatten<TTables>[TIdentifier] }>>;
	eq<TIdentifier extends keyof Flatten<TTables>, TNewParams>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier], any, TNewParams>,
	): BinaryExpressionBuilder<TTables, Prettify<TParams & TNewParams>>;
	eq<TValue, TLeftParams, TRightParams>(
		left: Expression<TValue, any, TLeftParams>,
		right: Expression<TValue, any, TRightParams>,
	): BinaryExpressionBuilder<TTables, Prettify<TParams & TLeftParams & TRightParams>>;
	eq(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("eq", args[0], args[1]);
	}
	ne(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("ne", args[0], args[1]);
	}
	gt(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("gt", args[0], args[1]);
	}
	gte(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("gte", args[0], args[1]);
	}
	lt(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("lt", args[0], args[1]);
	}
	lte(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("lte", args[0], args[1]);
	}
	in(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("in", args[0], args[1]);
	}
	notIn(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("nin", args[0], args[1]);
	}
	like(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("like", args[0], args[1]);
	}
	notLike(...args: any[]): BinaryExpressionBuilder<TTables, TParams> {
		return this.#compare("notLike", args[0], args[1]);
	}

	#compare(operator: string, left: unknown, right: unknown): BinaryExpressionBuilder<TTables, TParams> {
		return new BinaryExpressionBuilder({
			type: "booleancomparison",
			operator,
			left: serializeExpressionOperand(left),
			right: serializeExpressionOperand(right),
		});
	}
}

export class BooleanExpressionBuilder<TTables extends {}, TParams> {
	#node?: TBooleanExpression<any>;

	constructor(node?: TBooleanExpression<any>) {
		this.#node = node;
	}

	toJSON(): TBooleanExpression<any> {
		if (!this.#node) {
			throw new Error("Cannot serialize an empty boolean expression.");
		}
		return this.#node;
	}

	and(
		left: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
		right: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
	): BooleanExpressionBuilder<TTables, TParams> {
		return new BooleanExpressionBuilder({
			type: "booleanexpression",
			operator: "and",
			operands: [left.toJSON(), right.toJSON()],
		});
	}
	or(
		left: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
		right: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
	): BooleanExpressionBuilder<TTables, TParams> {
		return new BooleanExpressionBuilder({
			type: "booleanexpression",
			operator: "or",
			operands: [left.toJSON(), right.toJSON()],
		});
	}
	not(
		expr: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
	): BooleanExpressionBuilder<TTables, TParams> {
		return new BooleanExpressionBuilder({
			type: "booleanexpression",
			operator: "not",
			operands: [expr.toJSON()],
		});
	}
}

export class QueryExpressionBuilder<TTables extends {}, TFrom extends {}, TParams extends {}>
	extends ExpressionBuilder<TTables, TFrom, any, TParams> {
	eq<TLeftIdentifier extends keyof Flatten<TFrom>, TRightIdentifier extends keyof Flatten<TFrom>>(
		left: TLeftIdentifier,
		right: Flatten<TFrom>[TRightIdentifier] extends Flatten<TFrom>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TFrom, TParams>;
	eq<TIdentifier extends keyof Flatten<TFrom>, TParameter>(
		column: TIdentifier,
		expr: ParameterExpression<Flatten<TFrom>[TIdentifier], TParameter, any>,
	): BinaryExpressionBuilder<TFrom, Prettify<TParams & { [N in TParameter & string]: Flatten<TFrom>[TIdentifier] }>>;
	eq<TIdentifier extends keyof Flatten<TFrom>, TNewParams>(
		column: TIdentifier,
		expr: Expression<Flatten<TFrom>[TIdentifier], any, TNewParams>,
	): BinaryExpressionBuilder<TFrom, Prettify<TParams & TNewParams>>;
	eq<TValue, TLeftParams, TRightParams>(
		left: Expression<TValue, any, TLeftParams>,
		right: Expression<TValue, any, TRightParams>,
	): BinaryExpressionBuilder<TFrom, Prettify<TParams & TLeftParams & TRightParams>>;
	eq(...args: any[]): BinaryExpressionBuilder<any, any> {
		return new BinaryExpressionBuilder<TFrom, TParams>().eq(args[0], args[1]);
	}
	ne(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().ne(args[0], args[1]);
	}
	gt<TIdentifier extends keyof Flatten<TFrom>, TParameter>(
		column: TIdentifier,
		expr: ParameterExpression<Flatten<TFrom>[TIdentifier], TParameter, any>,
	): BinaryExpressionBuilder<TFrom, Prettify<TParams & { [N in TParameter & string]: Flatten<TFrom>[TIdentifier] }>>;
	gt<TIdentifier extends keyof Flatten<TFrom>, TNewParams>(
		column: TIdentifier,
		expr: Expression<Flatten<TFrom>[TIdentifier], any, TNewParams>,
	): BinaryExpressionBuilder<TFrom, Prettify<TParams & TNewParams>>;
	gt<TValue, TLeftParams, TRightParams>(
		left: Expression<TValue, any, TLeftParams>,
		right: Expression<TValue, any, TRightParams>,
	): BinaryExpressionBuilder<TFrom, Prettify<TParams & TLeftParams & TRightParams>>;
	gt(...args: any[]): BinaryExpressionBuilder<any, any> {
		return new BinaryExpressionBuilder<TFrom, TParams>().gt(args[0], args[1]);
	}
	gte(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().gte(args[0], args[1]);
	}
	lt(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().lt(args[0], args[1]);
	}
	lte(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().lte(args[0], args[1]);
	}
	in(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().in(args[0], args[1]);
	}
	notIn(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().notIn(args[0], args[1]);
	}
	like(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().like(args[0], args[1]);
	}
	notLike(...args: any[]): BinaryExpressionBuilder<TFrom, TParams> {
		return new BinaryExpressionBuilder<TFrom, TParams>().notLike(args[0], args[1]);
	}
	and(
		left: BinaryExpressionBuilder<TFrom, TParams> | BooleanExpressionBuilder<TFrom, TParams>,
		right: BinaryExpressionBuilder<TFrom, TParams> | BooleanExpressionBuilder<TFrom, TParams>,
	): BooleanExpressionBuilder<TFrom, TParams> {
		return new BooleanExpressionBuilder<TFrom, TParams>().and(left, right);
	}
	or(
		left: BinaryExpressionBuilder<TFrom, TParams> | BooleanExpressionBuilder<TFrom, TParams>,
		right: BinaryExpressionBuilder<TFrom, TParams> | BooleanExpressionBuilder<TFrom, TParams>,
	): BooleanExpressionBuilder<TFrom, TParams> {
		return new BooleanExpressionBuilder<TFrom, TParams>().or(left, right);
	}
	not(
		expr: BinaryExpressionBuilder<TFrom, TParams> | BooleanExpressionBuilder<TFrom, TParams>,
	): BooleanExpressionBuilder<TFrom, TParams> {
		return new BooleanExpressionBuilder<TFrom, TParams>().not(expr);
	}
}

function createQueryExpressionBuilder<TTables extends {}, TFrom extends {}, TParams extends {}>(): QueryExpressionBuilder<
	TTables,
	TFrom,
	TParams
> {
	return new QueryExpressionBuilder<TTables, TFrom, TParams>();
}

function buildSelectMap(columns: Array<string | Expression<any, any, any>>): Record<string, TReferenceOrLiteral> {
	return Object.fromEntries(columns.map((column) => {
		if (typeof column === "string") {
			return [lastIdentifier(column), parseIdentifier(column)];
		}
		const alias = resolveSelectionAlias(column);
		const serialized = serializeSelectable(column);
		if (serialized.type === "subquery") {
			return [alias, serialized as unknown as TReferenceOrLiteral];
		}
		return [alias, serialized];
	}));
}

function buildOrderBy(items: Array<string | Expression<any, any, any>>): TSelectStatement["orderBy"] {
	return items.map((item) => {
		if (typeof item === "string") {
			return { column: parseIdentifier(item), order: "ASC" };
		}
		return {
			column: serializeSelectable(item) as TReferenceOrLiteral,
			order: item instanceof IdentifierExpression && item.order ? item.order : "ASC",
		};
	});
}

function buildPredicate<TTables extends {}, TFrom extends {}, TParams extends {}>(
	args: any[],
	createBuilder: () => QueryExpressionBuilder<TTables, TFrom, TParams>,
): PredicateExpression {
	if (typeof args[0] === "function") {
		return args[0](createBuilder()).toJSON();
	}
	return {
		type: "booleancomparison",
		operator: normalizeBinaryOperator(args[1]),
		left: parseIdentifier(args[0]),
		right: { type: "literal", data: args[2] },
	};
}

function serializeSelectable(value: Expression<any, any, any>): SelectableExpression;
function serializeSelectable(value: string): TNamedColumnReference<string, unknown>;
function serializeSelectable(value: string | Expression<any, any, any>): SelectableExpression {
	if (typeof value === "string") {
		return parseIdentifier(value);
	}
	return value.toJSON();
}

function serializeExpressionOperand(value: unknown): TReferenceOrLiteral | TSubqueryExpression {
	if (isReferenceOrLiteralNode(value)) {
		return value;
	}
	if (typeof value === "string") {
		return value.includes(".") ? parseIdentifier(value) : { type: "literal", data: value };
	}
	if (
		value instanceof IdentifierExpression || value instanceof LiteralExpression || value instanceof ParameterExpression ||
		value instanceof SubqueryExpression || value instanceof FunctionExpression
	) {
		return value.toJSON();
	}
	return { type: "literal", data: value as string | number | boolean | Date | null };
}

function serializeWritableRecord<TValues extends Record<string, WritableValueExpression>>(
	values: TValues,
): Record<string, TReferenceOrLiteral> {
	return Object.fromEntries(
		Object.entries(values).map(([key, value]) => [key, serializeWritableValue(value)]),
	);
}

function serializeWritableValue(value: WritableValueExpression): TReferenceOrLiteral {
	if (isReferenceOrLiteralNode(value)) {
		return value;
	}
	if (
		value instanceof IdentifierExpression || value instanceof LiteralExpression || value instanceof ParameterExpression ||
		value instanceof SubqueryExpression || value instanceof FunctionExpression
	) {
		return value.toJSON() as TReferenceOrLiteral;
	}
	return { type: "literal", data: value };
}

function isReferenceOrLiteralNode(value: unknown): value is TReferenceOrLiteral {
	if (!value || typeof value !== "object" || !("type" in value)) {
		return false;
	}
	return ["literal", "functionref", "subquery", "tableref", "columnref", "paramref"].includes((value as { type: string }).type);
}

function resolveSelectionAlias(column: Expression<any, any, any>): string {
	if (column instanceof IdentifierExpression) {
		return column.alias ?? (column.toJSON().column as string);
	}
	if (column instanceof ParameterExpression) {
		return column.alias ?? column.name;
	}
	if (column instanceof LiteralExpression || column instanceof FunctionExpression || column instanceof SubqueryExpression) {
		if (!column.alias) {
			throw new Error("Selected expressions without a natural name must be aliased.");
		}
		return column.alias;
	}
	throw new Error("Unsupported selection expression.");
}

function parseIdentifier(identifier: string): TNamedColumnReference<string, unknown> {
	const separator = identifier.indexOf(".");
	if (separator === -1) {
		throw new Error(`Expected a dotted identifier, received ${identifier}.`);
	}
	return {
		type: "columnref",
		table: identifier.slice(0, separator),
		column: identifier.slice(separator + 1),
	};
}

function lastIdentifier(identifier: string): string {
	const separator = identifier.lastIndexOf(".");
	return separator === -1 ? identifier : identifier.slice(separator + 1);
}

function normalizeBinaryOperator(operator: BinaryOperator): string {
	switch (operator) {
		case "=":
			return "eq";
		case "!=":
		case "<>":
			return "ne";
		case ">":
			return "gt";
		case ">=":
			return "gte";
		case "<":
			return "lt";
		case "<=":
			return "lte";
		case "notIn":
			return "nin";
		default:
			return operator;
	}
}
