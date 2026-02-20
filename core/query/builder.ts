// deno-lint-ignore-file ban-types no-explicit-any

import {
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
	TReferenceOrLiteral,
	TSelectStatement,
	TStatement,
	TUpdateStatement,
} from "./schema.ts";
import type { Prettify } from "../prettify.ts";

// deno-fmt-ignore
export type InferModelFromTReferenceOrLiteral<T> =
	T extends TNamedColumnReference<any, infer TData> ? TData
	: T extends TNamedFunctionReference<any, any, infer TOutput> ? TOutput
	: T extends TNamedParamReference<any> ? any
	: T extends TLiteral<infer TData> ? TData
	: T extends Record<string, TReferenceOrLiteral> ? { [K in keyof T]: InferModelFromTReferenceOrLiteral<T[K]> }
	: never;

// deno-fmt-ignore
type _ExtractNamedParamReference<TExpr, M extends any[]> =
	M["length"] extends 8 ? never
	: TExpr extends TNamedParamReference<infer TName, infer TData> ? { [K in TName]: TData }
	: TExpr extends Record<string, TReferenceOrLiteral> ? { [K in keyof TExpr]: _ExtractNamedParamReference<TExpr[K], [1, ...M]> }[keyof TExpr]
	: TExpr extends TNamedFunctionReference<infer TName, infer TParams, infer TOutput> ? { [K in keyof TParams]: _ExtractNamedParamReference<TParams[K], [1, ...M]> }[number]
	: never;
export type ExtractNamedParamReference<T> = Prettify<UnionToIntersection<_ExtractNamedParamReference<T, []>>>;

export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never;

export class ReferenceOrLiteralBuilder<
	TTables extends {},
> {
	literal<TData extends null | string | number | boolean | Date>(value: TData): TLiteral<TData> {
		return { type: "literal", data: value };
	}
	ref<TTableName extends keyof TTables, TColumnName extends keyof TTables[TTableName]>(
		table: TTableName,
		column: TColumnName,
	): TNamedColumnReference<TColumnName, TTables[TTableName][TColumnName]> {
		return {
			type: "columnref",
			table: table as string,
			column: column,
		};
	}
	// param<TName extends string>(name: TName): TNamedParamReference<TName>;
	param<TName extends string, TData = any>(name: TName): TNamedParamReference<TName, TData>;
	param(name: string): TNamedParamReference<any> {
		return {
			type: "paramref",
			param: name,
		};
	}
	concat<TParams extends TReferenceOrLiteral[]>(...params: TParams): TNamedFunctionReference<"concat", TParams, string> {
		return {
			type: "functionref",
			name: "concat",
			params,
		};
	}
	invoke<TName extends string, TParams extends TReferenceOrLiteral[], TOutput>(
		name: TName,
		params: TParams,
	): TNamedFunctionReference<TName, TParams, TOutput> {
		return {
			type: "functionref",
			name,
			params,
		};
	}
}

export class BooleanExpressionBuilder<
	TTables extends {},
	TParams extends {},
> {
	and<TLeftParams extends {}, TRightParams extends {}>(
		left: TBooleanComparisonExpression<TLeftParams>,
		right: TBooleanComparisonExpression<TRightParams>,
	): TBooleanComparisonExpression<Prettify<TParams & TLeftParams & TRightParams>> {
		return {
			type: "booleancomparison",
			operator: "and",
			left,
			right,
		};
	}
	or<TLeftParams extends {}, TRightParams extends {}>(
		left: TBooleanComparisonExpression<TLeftParams>,
		right: TBooleanComparisonExpression<TRightParams>,
	): TBooleanComparisonExpression<Prettify<TParams & TLeftParams & TRightParams>> {
		return {
			type: "booleancomparison",
			operator: "or",
			left,
			right,
		};
	}
	equal<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	equal<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	equal<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	equal<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	equal<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	equal(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "eq",
			left,
			right,
		};
	}

	notEqual<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	notEqual<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	notEqual<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	notEqual<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	notEqual<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	notEqual(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "ne",
			left,
			right,
		};
	}

	greaterThan<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	greaterThan<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	greaterThan<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	greaterThan<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	greaterThan<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	greaterThan(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "gt",
			left,
			right,
		};
	}

	greaterThanOrEqual<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	greaterThanOrEqual<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	greaterThanOrEqual<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	greaterThanOrEqual<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	greaterThanOrEqual<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	greaterThanOrEqual(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "gte",
			left,
			right,
		};
	}

	lessThan<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	lessThan<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	lessThan<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	lessThan<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	lessThan<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	lessThan(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "lt",
			left,
			right,
		};
	}

	lessThanOrEqual<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	lessThanOrEqual<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	lessThanOrEqual<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	lessThanOrEqual<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	lessThanOrEqual<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	lessThanOrEqual(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "lte",
			left,
			right,
		};
	}

	in<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	in<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	in<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	in<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	in<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	in(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "in",
			left,
			right,
		};
	}

	notIn<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedParamReference<TParam>,
		right: TNamedColumnReference<any, TData> | TLiteral<TData>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	notIn<TParam extends string, TData extends null | string | number | boolean | Date>(
		left: TNamedColumnReference<any, TData> | TLiteral<TData>,
		right: TNamedParamReference<TParam>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParam]: TData }>>;
	notIn<TParamLeft extends string, TParamRight extends string>(
		left: TNamedParamReference<TParamLeft>,
		right: TNamedParamReference<TParamRight>,
	): TBooleanComparisonExpression<Prettify<TParams & { [a in TParamLeft]: any } & { [a in TParamRight]: any }>>;
	notIn<TDataLeft extends null | string | number | boolean | Date, TDataRight>(
		left: TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft>,
		right: TDataRight extends TDataLeft ? TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight> : never,
	): TBooleanComparisonExpression<{}>;
	notIn<TDataLeft extends null | string | number | boolean | Date, TDataRight extends null | string | number | boolean | Date>(
		left: TDataLeft extends TDataRight ? TNamedColumnReference<any, TDataLeft> | TLiteral<TDataLeft> : never,
		right: TNamedColumnReference<any, TDataRight> | TLiteral<TDataRight>,
	): TBooleanComparisonExpression<{}>;
	notIn(left: any, right: any): TBooleanComparisonExpression<{}> {
		return {
			type: "booleancomparison",
			operator: "nin",
			left,
			right,
		};
	}
}

export interface ExpressionBuilder<
	TTables extends {},
	TParams extends {},
> extends ReferenceOrLiteralBuilder<TTables>, BooleanExpressionBuilder<TTables, TParams> {}
export class ExpressionBuilder<
	TTables extends {},
	TParams extends {},
> {}

applyMixin(ExpressionBuilder, [ReferenceOrLiteralBuilder, BooleanExpressionBuilder]);

export interface IStatementBuilder<TParams extends {}, TOutput> {
	build(): TAnyStatement;
	toStatement(): TStatement<TParams, TOutput>;
}

export class StatementBuilder<
	TTables extends {},
	TInsertTables extends {},
> {
	select<TName extends keyof TTables>(
		table: TName,
	): SelectStatementBuilder<TTables, { [a in TName]: TTables[TName] }, {}, {}, false>;
	select<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): SelectStatementBuilder<TTables, { [a in TAlias]: TTables[TName] }, {}, {}, false>;
	select(table: any, alias?: any): any {
		return new SelectStatementBuilder<{}, {}, {}, {}>(
			{ type: "tableref", table, alias },
			[],
			{},
			undefined,
			[],
			[],
			undefined,
			undefined,
		);
	}

	insert<TName extends keyof TInsertTables>(
		table: TName,
	): InsertStatementBuilder<TTables, TInsertTables, { [a in TName]: TInsertTables[TName] }, TInsertTables[TName], {}>;
	insert<TName extends keyof TInsertTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): InsertStatementBuilder<TTables, TInsertTables, { [a in TAlias]: TInsertTables[TName] }, TInsertTables[TName], {}>;
	insert(table: any, alias?: any): any {
		return new InsertStatementBuilder<{}, {}, {}, {}, {}>(
			{ type: "tableref", table, alias },
			[],
			undefined,
		);
	}

	update<TName extends keyof TTables>(
		table: TName,
	): UpdateStatementBuilder<TTables, { [a in TName]: TTables[TName] }, TTables[TName], {}>;
	update<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): UpdateStatementBuilder<TTables, { [a in TAlias]: TTables[TName] }, TTables[TName], {}>;
	update(table: any, alias?: any): any {
		return new UpdateStatementBuilder<{}, {}, {}, {}>(
			{ type: "tableref", table, alias },
			{},
			[],
			undefined,
			undefined,
		);
	}

	delete<TName extends keyof TTables>(table: TName): DeleteStatementBuilder<TTables, { [a in TName]: TTables[TName] }, {}>;
	delete<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): DeleteStatementBuilder<TTables, { [a in TAlias]: TTables[TName] }, {}>;
	delete(table: any, alias?: any): any {
		return new DeleteStatementBuilder<{}, {}, {}>(
			{ type: "tableref", table, alias },
			[],
			undefined,
			undefined,
		);
	}
}

export class BatchableStatementBuilder<
	TTables extends {},
	TInsertTables extends {},
> extends StatementBuilder<TTables, TInsertTables> {
	batch(): BatchStatementBuilder<TTables, TInsertTables, {}> {
		return new BatchStatementBuilder<any, any, {}>([], []);
	}
}

export class BatchStatementBuilder<TTables extends {}, TInsertTables extends {}, TParams extends {}>
	implements IStatementBuilder<TParams, void> {
	#statements: TAnyStatement[];
	#check: TCheck[];

	constructor(statements: TAnyStatement[], checks: TCheck[]) {
		this.#statements = statements;
		this.#check = checks;
	}

	build(): TBatchStatement {
		return {
			type: "batch",
			checks: [...this.#check],
			statements: [...this.#statements],
		};
	}

	toStatement(): TStatement<TParams, void> {
		return {
			type: "statement",
			statement: this.build(),
		};
	}

	execute<TOtherParams extends {}>(
		statement:
			| InsertStatementBuilder<TTables, TInsertTables, any, any, TOtherParams>
			| UpdateStatementBuilder<TTables, any, any, TOtherParams>
			| DeleteStatementBuilder<TTables, any, TOtherParams>,
	): BatchStatementBuilder<TTables, TInsertTables, Prettify<TParams & TOtherParams>> {
		return new BatchStatementBuilder<any, any, any>([...this.#statements, statement.build()], this.#check);
	}

	checkIfExists<TSelectParams extends {}>(
		statement: SelectStatementBuilder<TTables, TInsertTables, any, TSelectParams>,
	): BatchStatementBuilder<TTables, TInsertTables, Prettify<TParams & TSelectParams>> {
		return new BatchStatementBuilder<any, any, any>(this.#statements, [...this.#check, {
			type: "exists",
			select: statement.build(),
		}]);
	}

	checkIfNotExists<TSelectParams extends {}>(
		statement: SelectStatementBuilder<TTables, TInsertTables, any, TSelectParams>,
	): BatchStatementBuilder<TTables, TInsertTables, Prettify<TParams & TSelectParams>> {
		return new BatchStatementBuilder<any, any, any>(this.#statements, [...this.#check, {
			type: "not_exists",
			select: statement.build(),
		}]);
	}
}

export class InsertStatementBuilder<
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

	columns<TColumns extends (keyof TModel)[]>(
		...columns: TColumns
	): InsertStatementBuilder<TTables, TInsertTables, TFrom, TModel, Prettify<TParams & { [K in TColumns[number]]: TModel[K] }>> {
		return new InsertStatementBuilder<any, any, any, any, any>(
			this.#into,
			[...this.#columns, ...columns as string[]],
			this.#values,
			this.#from,
		);
	}

	values<TValues extends Record<string, TReferenceOrLiteral>>(
		builder: (
			expr: ReferenceOrLiteralBuilder<TFrom>,
		) => InferModelFromTReferenceOrLiteral<TValues> extends TModel ? TValues
			: [InferModelFromTReferenceOrLiteral<TValues>, "should extends", TModel],
	): InsertStatementBuilder<TTables, TInsertTables, TFrom, TModel, Prettify<TParams & ExtractNamedParamReference<TValues>>> {
		return new InsertStatementBuilder<any, any, any, any, any>(
			this.#into,
			this.#columns,
			[...(this.#values ?? []), builder(new ExpressionBuilder()) as never],
			undefined,
		);
	}

	from<TSelectParams extends {}, TSelectModel>(
		builder: (
			expr: StatementBuilder<TTables, TInsertTables>,
		) => TSelectModel extends TModel ? SelectStatementBuilder<any, any, TSelectModel, TSelectParams, any>
			: [TSelectModel, "should extends", TModel],
	): InsertStatementBuilder<TTables, TInsertTables, TFrom, TModel, Prettify<TParams & TSelectParams>> {
		return new InsertStatementBuilder<any, any, any, any, any>(
			this.#into,
			this.#columns,
			undefined,
			(builder(new StatementBuilder<TTables, TInsertTables>()) as SelectStatementBuilder<any, any, any, any, boolean>).build(),
		);
	}
}

export class UpdateStatementBuilder<
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

	set<TValues extends Record<string, TReferenceOrLiteral>>(
		builder: (
			expr: ReferenceOrLiteralBuilder<TFrom>,
		) => InferModelFromTReferenceOrLiteral<TValues> extends Partial<TModel> ? TValues
			: [InferModelFromTReferenceOrLiteral<TValues>, "should extends", Partial<TModel>],
	): UpdateStatementBuilder<TTables, TFrom, TModel, Prettify<TParams & ExtractNamedParamReference<TValues>>> {
		return new UpdateStatementBuilder<any, any, any, any>(
			this.#table,
			builder(new ExpressionBuilder()) as never,
			this.#join,
			this.#where,
			this.#limit,
		);
	}

	join<TName extends keyof TTables, TOnParams extends {}>(
		table: TName,
		on: (
			expr: ExpressionBuilder<Prettify<TFrom & { [a in TName]: TTables[TName] }>, TParams>,
		) => TBooleanComparisonExpression<TOnParams> | TBooleanExpression<TOnParams>,
	): UpdateStatementBuilder<
		TTables,
		Prettify<TFrom & { [a in TName]: TTables[TName] }>,
		TModel,
		Prettify<TParams & TOnParams>
	>;
	join<TName extends keyof TTables, TAlias extends string, TOnParams extends {}>(
		table: TName,
		alias: TAlias,
		on: (
			expr: ExpressionBuilder<Prettify<TFrom & { [a in TAlias]: TTables[TName] }>, TParams>,
		) => TBooleanComparisonExpression<TOnParams> | TBooleanExpression<TOnParams>,
	): UpdateStatementBuilder<
		TTables,
		Prettify<TFrom & { [a in TAlias]: TTables[TName] }>,
		TModel,
		Prettify<TParams & TOnParams>
	>;
	join(table: any, alias: any, on?: any): UpdateStatementBuilder<{}, {}, {}, {}> {
		return new UpdateStatementBuilder<{}, {}, {}, {}>(
			this.#table,
			this.#set,
			[...this.#join, { type: "join", table, alias, on: on(new ExpressionBuilder()) }],
			this.#where,
			this.#limit,
		);
	}

	where<TWhereParams extends {}>(
		builder: (
			expr: ExpressionBuilder<TFrom, TParams>,
		) => TBooleanComparisonExpression<TWhereParams> | TBooleanExpression<TWhereParams>,
	): UpdateStatementBuilder<TTables, TFrom, TModel, Prettify<TParams & TWhereParams>> {
		return new UpdateStatementBuilder<TTables, TFrom, TModel, Prettify<TParams & TWhereParams>>(
			this.#table,
			this.#set,
			this.#join,
			builder(new ExpressionBuilder()),
			this.#limit,
		);
	}

	limit(limit: number): UpdateStatementBuilder<TTables, TFrom, TModel, TParams> {
		return new UpdateStatementBuilder<TTables, TFrom, TModel, TParams>(
			this.#table,
			this.#set,
			this.#join,
			this.#where,
			limit,
		);
	}
}

export class DeleteStatementBuilder<
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

	join<TName extends keyof TTables, TOnParams extends {}>(
		table: TName,
		on: (
			expr: ExpressionBuilder<Prettify<TFrom & { [a in TName]: TTables[TName] }>, TParams>,
		) => TBooleanComparisonExpression<TOnParams> | TBooleanExpression<TOnParams>,
	): DeleteStatementBuilder<
		TTables,
		Prettify<TFrom & { [a in TName]: TTables[TName] }>,
		Prettify<TParams & TOnParams>
	>;
	join<TName extends keyof TTables, TAlias extends string, TOnParams extends {}>(
		table: TName,
		alias: TAlias,
		on: (
			expr: ExpressionBuilder<Prettify<TFrom & { [a in TAlias]: TTables[TName] }>, TParams>,
		) => TBooleanComparisonExpression<TOnParams> | TBooleanExpression<TOnParams>,
	): DeleteStatementBuilder<
		TTables,
		Prettify<TFrom & { [a in TAlias]: TTables[TName] }>,
		Prettify<TParams & TOnParams>
	>;
	join(table: any, alias: any, on?: any): DeleteStatementBuilder<{}, {}, {}> {
		return new DeleteStatementBuilder<{}, {}, {}>(
			this.#table,
			[...this.#join, { type: "join", table, alias, on: on(new ExpressionBuilder()) }],
			this.#where,
			this.#limit,
		);
	}

	where<TWhereParams extends {}>(
		builder: (
			expr: ExpressionBuilder<TFrom, TParams>,
		) => TBooleanComparisonExpression<TWhereParams> | TBooleanExpression<TWhereParams>,
	): DeleteStatementBuilder<TTables, TFrom, Prettify<TParams & TWhereParams>> {
		return new DeleteStatementBuilder<TTables, TFrom, Prettify<TParams & TWhereParams>>(
			this.#table,
			this.#join,
			builder(new ExpressionBuilder()),
			this.#limit,
		);
	}

	limit(limit: number): DeleteStatementBuilder<TTables, TFrom, TParams> {
		return new DeleteStatementBuilder<TTables, TFrom, TParams>(
			this.#table,
			this.#join,
			this.#where,
			limit,
		);
	}
}

export class SelectStatementBuilder<
	TTables extends {},
	TFrom extends {},
	TModel,
	TParams extends {},
	TSingleResult extends boolean = false,
> implements IStatementBuilder<TParams, TSingleResult extends true ? TModel : TModel[]> {
	#from: TSelectStatement["from"];
	#join: TSelectStatement["join"];
	#select: TSelectStatement["select"];
	#where: TSelectStatement["where"];
	#groupBy: TSelectStatement["groupBy"];
	#orderBy: TSelectStatement["orderBy"];
	#limit: TSelectStatement["limit"];
	#offset: TSelectStatement["offset"];

	constructor(
		from: TSelectStatement["from"],
		join: TSelectStatement["join"],
		select: TSelectStatement["select"],
		where: TSelectStatement["where"],
		groupBy: TSelectStatement["groupBy"],
		orderBy: TSelectStatement["orderBy"],
		limit: TSelectStatement["limit"],
		offset: TSelectStatement["offset"],
	) {
		this.#from = from;
		this.#join = join;
		this.#select = select;
		this.#where = where;
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
			groupBy: this.#groupBy,
			orderBy: this.#orderBy,
			limit: this.#limit,
			offset: this.#offset,
		};
	}

	toStatement(): TStatement<TParams, TSingleResult extends true ? TModel : TModel[]> {
		return {
			type: "statement",
			statement: this.build(),
		};
	}

	join<TName extends keyof TTables, TOnParams extends {}>(
		table: TName,
		on: (
			expr: ExpressionBuilder<Prettify<TFrom & { [a in TName]: TTables[TName] }>, TParams>,
		) => TBooleanComparisonExpression<TOnParams> | TBooleanExpression<TOnParams>,
	): SelectStatementBuilder<
		TTables,
		Prettify<TFrom & { [a in TName]: TTables[TName] }>,
		TModel,
		Prettify<TParams & TOnParams>,
		TSingleResult
	>;
	join<TName extends keyof TTables, TAlias extends string, TOnParams extends {}>(
		table: TName,
		alias: TAlias,
		on: (
			expr: ExpressionBuilder<Prettify<TFrom & { [a in TAlias]: TTables[TName] }>, TParams>,
		) => TBooleanComparisonExpression<TOnParams> | TBooleanExpression<TOnParams>,
	): SelectStatementBuilder<
		TTables,
		Prettify<TFrom & { [a in TAlias]: TTables[TName] }>,
		TModel,
		Prettify<TParams & TOnParams>,
		TSingleResult
	>;
	join(table: any, alias: any, on?: any): SelectStatementBuilder<{}, {}, {}, {}> {
		return new SelectStatementBuilder<{}, {}, {}, {}>(
			this.#from,
			[...this.#join, { type: "join", table, alias, on: on(new ExpressionBuilder()) }],
			{},
			this.#where,
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}

	pick<TSelect extends Record<string, TReferenceOrLiteral>>(
		builder: (expr: ReferenceOrLiteralBuilder<TFrom>) => TSelect,
	): SelectStatementBuilder<
		TTables,
		TFrom,
		InferModelFromTReferenceOrLiteral<TSelect>,
		Prettify<TParams & ExtractNamedParamReference<TSelect>>,
		TSingleResult
	> {
		return new SelectStatementBuilder<
			TTables,
			TFrom,
			InferModelFromTReferenceOrLiteral<TSelect>,
			Prettify<TParams & ExtractNamedParamReference<TSelect>>,
			TSingleResult
		>(
			this.#from,
			this.#join,
			builder(new ReferenceOrLiteralBuilder<TFrom>()),
			this.#where,
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}

	where<TWhereParams extends {}>(
		builder: (
			expr: ExpressionBuilder<TFrom, TParams>,
		) => TBooleanComparisonExpression<TWhereParams> | TBooleanExpression<TWhereParams>,
	): SelectStatementBuilder<TTables, TFrom, TModel, Prettify<TParams & TWhereParams>, TSingleResult> {
		return new SelectStatementBuilder<TTables, TFrom, TModel, Prettify<TParams & TWhereParams>, TSingleResult>(
			this.#from,
			this.#join,
			this.#select,
			builder(new ExpressionBuilder()),
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			this.#offset,
		);
	}

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
	): TLimit extends 1 ? SelectStatementBuilder<TTables, TFrom, TModel, TParams, true>
		: SelectStatementBuilder<TTables, TFrom, TModel, TParams, false> {
		return new SelectStatementBuilder<TTables, TFrom, TModel, TParams, false>(
			this.#from,
			this.#join,
			this.#select,
			this.#where,
			this.#groupBy,
			this.#orderBy,
			limit,
			this.#offset,
		);
	}

	offset(offset: number): SelectStatementBuilder<TTables, TFrom, TModel, TParams, TSingleResult> {
		return new SelectStatementBuilder<TTables, TFrom, TModel, TParams, false>(
			this.#from,
			this.#join,
			this.#select,
			this.#where,
			this.#groupBy,
			this.#orderBy,
			this.#limit,
			offset,
		);
	}
}

function applyMixin(ctor: any, constructors: any[]): void {
	constructors.forEach((baseCtor) => {
		Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
			Object.defineProperty(
				ctor.prototype,
				name,
				Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
					Object.create(null),
			);
		});
	});
}
