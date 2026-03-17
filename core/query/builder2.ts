// deno-lint-ignore-file no-explicit-any ban-types no-unused-vars
type Prettify<T> = { [K in keyof T]: T[K] } & {};

type UnionToTuple<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I[] : never;

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

class RootQueryBuilder<TTables> {
	selectFrom<TName extends keyof TTables>(table: TName): SelectQueryBuilder<TTables, { [K in TName]: TTables[K] }, {}, false, {}>;
	selectFrom<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): SelectQueryBuilder<TTables, { [K in TAlias]: TTables[TName] }, {}, false, {}>;
	selectFrom(table: string, alias?: string): SelectQueryBuilder<any, any, any, false, {}> {
		return new SelectQueryBuilder();
	}
	// insertInto<TName extends keyof TTables>(table: TName) {}
	// updateFrom<TName extends keyof TTables>(table: TName) {}
	// deleteFrom<TName extends keyof TTables>(table: TName) {}
}

class IdentifierExpression<TOutput, TAlias> {
	#kind!: "identifier";

	as<TNewAlias extends string>(alias: TNewAlias): IdentifierExpression<TOutput, TNewAlias> {
		return new IdentifierExpression();
	}
	asc(): IdentifierExpression<TOutput, TAlias> {
		return new IdentifierExpression();
	}
	desc(): IdentifierExpression<TOutput, TAlias> {
		return new IdentifierExpression();
	}
}

class LiteralExpression<TOutput, TAlias> {
	#kind!: "literal";

	as<TNewAlias extends string>(alias: TNewAlias): LiteralExpression<TOutput, TNewAlias> {
		return new LiteralExpression();
	}
}

class ParameterExpression<TOutput, TName, TParams> {
	#kind!: "parameter";
	as<TNewOutput>(): ParameterExpression<TNewOutput, TName, { [N in TName & string]: TNewOutput }> {
		return new ParameterExpression();
	}
}

class SubqueryExpression<TOutput, TAlias, TParams> {
	#kind!: "subquery";

	as<TNewAlias extends string>(alias: TNewAlias): SubqueryExpression<TOutput, TNewAlias, TParams> {
		return new SubqueryExpression();
	}
}

class FunctionExpression<TOutput, TAlias, TParams> {
	#kind!: "function";
	as<TNewAlias extends string>(alias: TNewAlias): FunctionExpression<TOutput, TNewAlias, TParams> {
		return new FunctionExpression();
	}
}

type Expression<TOutput, TAlias, TParams> =
	| IdentifierExpression<TOutput, TAlias>
	| LiteralExpression<TOutput, TAlias>
	| ParameterExpression<TOutput, TAlias, TParams>
	| SubqueryExpression<TOutput, TAlias, TParams>
	| FunctionExpression<TOutput, TAlias, TParams>;

class ExpressionBuilder<TTables, TFrom, TOutput, TParams> {
	literal<TLiteral extends string | number | boolean | Date | null>(value: TLiteral): LiteralExpression<TLiteral, never> {
		return new LiteralExpression();
	}
	column<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
	): IdentifierExpression<Flatten<TFrom>[TIdentifier], LastIdentifier<TIdentifier>> {
		return new IdentifierExpression();
	}
	param<TName extends string, TValue>(name: TName): ParameterExpression<TValue, TName, { [N in TName]: TValue }> {
		return new ParameterExpression();
	}
	select<TSelectOutput, TParams>(
		builder: (q: RootQueryBuilder<TTables>) => SelectQueryBuilder<TTables, TFrom, TSelectOutput, any, TParams>,
	): SubqueryExpression<TSelectOutput, never, TParams> {
		return new SubqueryExpression();
	}
	fn<TReturn, TParams>(name: string, ...args: Expression<any, never, TParams>[]): FunctionExpression<TReturn, never, TParams> {
		return new FunctionExpression<TReturn, never, TParams>();
	}
}

class SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams> {
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
	select<const TColumns extends Array<(keyof Flatten<TFrom>) | Expression<any, any, any>>, TNewParams>(
		builder: (q: ExpressionBuilder<TTables, TFrom, any, TNewParams>) => TColumns,
	): SelectQueryBuilder<
		TTables,
		TFrom,
		Prettify<
			& TOutput
			& ColumnsToOutput<TFrom, TColumns>
		>,
		TSingle,
		Prettify<TParams & TNewParams>
	>;
	select(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder();
	}
	leftJoin<TName extends keyof TTables, TNewParams>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& ExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TFrom, any, TParams>,
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
				& ExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TFrom, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	leftJoin(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder();
	}
	rightJoin<TName extends keyof TTables, TNewParams>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& ExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TFrom, any, TParams>,
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
				& ExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TFrom, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	rightJoin(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder();
	}
	innerJoin<TName extends keyof TTables, TNewParams>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TParams>
				& ExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TFrom, any, TParams>,
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
				& ExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TFrom, any, TParams>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TNewParams>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	innerJoin(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder();
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
		return new SelectQueryBuilder();
	}
	groupBy(columns: Array<keyof Flatten<TFrom>>): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams> {
		return new SelectQueryBuilder();
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
				& ExpressionBuilder<{ "": TOutput }, TFrom, any, TParams>,
		) => BinaryExpressionBuilder<{ "": TOutput }, TNewParams> | BooleanExpressionBuilder<{ "": TOutput }, TNewParams>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	having(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder();
	}
	orderBy(columns: Array<keyof Flatten<TFrom>>): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, TParams>;
	orderBy<TNewParams>(
		builder: (q: ExpressionBuilder<TTables, TFrom, any, TParams>) => Array<(keyof Flatten<TFrom>) | Expression<any, any, any>>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle, Prettify<TParams & TNewParams>>;
	orderBy(...args: any[]): SelectQueryBuilder<any, any, any, any, any> {
		return new SelectQueryBuilder();
	}
	limit<const TLimit extends number>(limit: TLimit): SelectQueryBuilder<TTables, TFrom, TOutput, TLimit extends 1 ? true : false, TParams> {
		return new SelectQueryBuilder();
	}
}

type BinaryOperator = "=" | "!=" | "<>" | ">" | ">=" | "<" | "<=" | "in" | "notIn" | "like" | "notLike";

class BinaryExpressionBuilder<TTables, TParams> {
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
		return new BinaryExpressionBuilder();
	}
	// ne
	// gt
	// gte
	// lt
	// lte
	// in
	// notIn
	// like
	// notLike
}

class BooleanExpressionBuilder<TTables, TParams> {
	and(
		left: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
		right: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
	): BooleanExpressionBuilder<TTables, TParams> {
		return new BooleanExpressionBuilder();
	}
	or(
		left: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
		right: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
	): BooleanExpressionBuilder<TTables, TParams> {
		return new BooleanExpressionBuilder();
	}
	not(
		expr: BinaryExpressionBuilder<TTables, TParams> | BooleanExpressionBuilder<TTables, TParams>,
	): BooleanExpressionBuilder<TTables, TParams> {
		return new BooleanExpressionBuilder();
	}
}

type Models = {
	users: {
		id: number;
		name: string;
	};
	posts: {
		id: number;
		title: string;
		content: string;
		postedAt: Date;
		authorId: number;
	};
};

// type _a = Flatten<Models>;
const q = new RootQueryBuilder<Models>();

const a = q
	.selectFrom("posts", "p")
	.innerJoin("users", "u", (q) => q.eq("u.id", "p.authorId"))
	.select((q) => ["p.id", "p.title", "p.postedAt", "u.name", q.literal(42).as("answer")])
	.where((q) => q.eq("p.postedAt", q.param("since")))
	.groupBy(["u.id"])
	.having(".title", "notLike", "%Test%")
	.orderBy((q) => [q.column("p.postedAt").desc(), "p.title"])
	.limit(1);
