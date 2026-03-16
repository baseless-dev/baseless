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
		& { [P in TColumns[number] as P extends ParameterExpression<any, infer A> ? A & string : never]: P extends ParameterExpression<infer T, any> ? T : unknown; }
		& { [P in TColumns[number] as P extends SubqueryExpression<any, infer A> ? A & string : never]: P extends SubqueryExpression<infer T, any> ? T : unknown; }
		& { [P in TColumns[number] as P extends FunctionExpression<any, infer A> ? A & string : never]: P extends FunctionExpression<infer T, any> ? T : unknown; }
	>;

class RootQueryBuilder<TTables> {
	selectFrom<TName extends keyof TTables>(table: TName): SelectQueryBuilder<TTables, { [K in TName]: TTables[K] }, {}, false>;
	selectFrom<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
	): SelectQueryBuilder<TTables, { [K in TAlias]: TTables[TName] }, {}, false>;
	selectFrom(table: string, alias?: string): SelectQueryBuilder<any, any, any, false> {
		return new SelectQueryBuilder();
	}
	insertInto<TName extends keyof TTables>(table: TName) {}
	updateFrom<TName extends keyof TTables>(table: TName) {}
	deleteFrom<TName extends keyof TTables>(table: TName) {}
}

class Expression<TOutput, TAlias> {}

class IdentifierExpression<TOutput, TAlias> extends Expression<TOutput, TAlias> {
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

class LiteralExpression<TOutput, TAlias> extends Expression<TOutput, TAlias> {
	#kind!: "literal";

	as<TNewAlias extends string>(alias: TNewAlias): LiteralExpression<TOutput, TNewAlias> {
		return new LiteralExpression();
	}
}

class ParameterExpression<TOutput, TName> extends Expression<TOutput, TName> {
	#kind!: "parameter";
}

class SubqueryExpression<TOutput, TAlias> extends Expression<TOutput, TAlias> {
	#kind!: "subquery";

	as<TNewAlias extends string>(alias: TNewAlias): SubqueryExpression<TOutput, TNewAlias> {
		return new SubqueryExpression();
	}
}

class FunctionExpression<TOutput, TAlias> extends Expression<TOutput, TAlias> {
	#kind!: "function";
	as<TNewAlias extends string>(alias: TNewAlias): FunctionExpression<TOutput, TNewAlias> {
		return new FunctionExpression();
	}
}

class ExpressionBuilder<TTables, TFrom, TOutput> {
	literal<TLiteral extends string | number | boolean | Date | null>(value: TLiteral): LiteralExpression<TLiteral, never> {
		return new LiteralExpression();
	}
	column<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
	): IdentifierExpression<Flatten<TFrom>[TIdentifier], LastIdentifier<TIdentifier>> {
		return new IdentifierExpression();
	}
	param<TName extends string, TValue>(name: TName): ParameterExpression<TValue, TName> {
		return new ParameterExpression();
	}
	select<TSelectOutput>(
		builder: (q: RootQueryBuilder<TTables>) => SelectQueryBuilder<TTables, TFrom, TSelectOutput, any>,
	): SubqueryExpression<TSelectOutput, never> {
		return new SubqueryExpression();
	}
	fn<TReturn>(name: string, ...args: Expression<any, never>[]): FunctionExpression<TReturn, never> {
		return new FunctionExpression<TReturn, never>();
	}
}

class SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
	select<const TColumns extends Array<keyof Flatten<TFrom>>>(
		columns: TColumns,
	): SelectQueryBuilder<
		TTables,
		TFrom,
		Prettify<
			& TOutput
			& ColumnsToOutput<TFrom, TColumns>
		>,
		TSingle
	>;
	select<const TColumns extends Array<(keyof Flatten<TFrom>) | Expression<any, any>>>(
		builder: (q: ExpressionBuilder<TTables, TFrom, any>) => TColumns,
	): SelectQueryBuilder<
		TTables,
		TFrom,
		Prettify<
			& TOutput
			& ColumnsToOutput<TFrom, TColumns>
		>,
		TSingle
	>;
	select(...args: any[]): SelectQueryBuilder<any, any, any, any> {
		return new SelectQueryBuilder();
	}
	leftJoin<TName extends keyof TTables>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
				& ExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TFrom, any>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOutput, TSingle>;
	leftJoin<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
				& ExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TFrom, any>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle>;
	leftJoin(...args: any[]): SelectQueryBuilder<any, any, any, any> {
		return new SelectQueryBuilder();
	}
	rightJoin<TName extends keyof TTables>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
				& ExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TFrom, any>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOutput, TSingle>;
	rightJoin<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
				& ExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TFrom, any>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle>;
	rightJoin(...args: any[]): SelectQueryBuilder<any, any, any, any> {
		return new SelectQueryBuilder();
	}
	innerJoin<TName extends keyof TTables>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
				& ExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>, TFrom, any>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TName]: TTables[TName] }>>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TName]: TTables[TName] }>, TOutput, TSingle>;
	innerJoin<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
				& BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
				& ExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TFrom, any>,
		) =>
			| BinaryExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>
			| BooleanExpressionBuilder<Prettify<TFrom & { [K in TAlias]: TTables[TName] }>>,
	): SelectQueryBuilder<TTables, Prettify<TFrom & { [K in TAlias]: TTables[TName] }>, TOutput, TSingle>;
	innerJoin(...args: any[]): SelectQueryBuilder<any, any, any, any> {
		return new SelectQueryBuilder();
	}
	where<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
		op: BinaryOperator,
		value: Flatten<TFrom>[TIdentifier],
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	where(
		builder: (
			q: BinaryExpressionBuilder<TFrom> & BooleanExpressionBuilder<TFrom> & ExpressionBuilder<TTables, TFrom, any>,
		) => BinaryExpressionBuilder<TFrom> | BooleanExpressionBuilder<TFrom>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	where(...args: any[]): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
		return new SelectQueryBuilder();
	}
	groupBy(columns: Array<keyof Flatten<TFrom>>): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
		return new SelectQueryBuilder();
	}
	having<TIdentifier extends keyof Flatten<{ "": TOutput }>>(
		column: TIdentifier,
		op: BinaryOperator,
		value: Flatten<{ "": TOutput }>[TIdentifier],
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	having(
		builder: (
			q:
				& BinaryExpressionBuilder<{ "": TOutput }>
				& BooleanExpressionBuilder<{ "": TOutput }>
				& ExpressionBuilder<{ "": TOutput }, TFrom, any>,
		) => BinaryExpressionBuilder<{ "": TOutput }> | BooleanExpressionBuilder<{ "": TOutput }>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	having(...args: any[]): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
		return new SelectQueryBuilder();
	}
	orderBy(columns: Array<keyof Flatten<TFrom>>): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	orderBy(
		builder: (q: ExpressionBuilder<TTables, TFrom, any>) => Array<(keyof Flatten<TFrom>) | Expression<any, any>>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	orderBy(...args: any[]): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
		return new SelectQueryBuilder();
	}
	limit<const TLimit extends number>(limit: TLimit): SelectQueryBuilder<TTables, TFrom, TOutput, TLimit extends 1 ? true : false> {
		return new SelectQueryBuilder();
	}
}

type BinaryOperator = "=" | "!=" | "<>" | ">" | ">=" | "<" | "<=" | "in" | "notIn" | "like" | "notLike";

class BinaryExpressionBuilder<TTables> {
	eq<TLeftIdentifier extends keyof Flatten<TTables>, TRightIdentifier extends keyof Flatten<TTables>>(
		left: TLeftIdentifier,
		right: Flatten<TTables>[TRightIdentifier] extends Flatten<TTables>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TTables>;
	eq<TIdentifier extends keyof Flatten<TTables>>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier], never>,
	): BinaryExpressionBuilder<TTables>;
	eq<TValue>(left: Expression<TValue, never>, right: Expression<TValue, never>): BinaryExpressionBuilder<TTables>;
	eq(...args: any[]): BinaryExpressionBuilder<TTables> {
		return new BinaryExpressionBuilder();
	}
	ne<TLeftIdentifier extends keyof Flatten<TTables>, TRightIdentifier extends keyof Flatten<TTables>>(
		left: TLeftIdentifier,
		right: Flatten<TTables>[TRightIdentifier] extends Flatten<TTables>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TTables>;
	ne<TIdentifier extends keyof Flatten<TTables>>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier], never>,
	): BinaryExpressionBuilder<TTables>;
	ne<TValue>(left: Expression<TValue, never>, right: Expression<TValue, never>): BinaryExpressionBuilder<TTables>;
	ne(...args: any[]): BinaryExpressionBuilder<TTables> {
		return new BinaryExpressionBuilder();
	}
	gt<TLeftIdentifier extends keyof Flatten<TTables>, TRightIdentifier extends keyof Flatten<TTables>>(
		left: TLeftIdentifier,
		right: Flatten<TTables>[TRightIdentifier] extends Flatten<TTables>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TTables>;
	gt<TIdentifier extends keyof Flatten<TTables>>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier], never>,
	): BinaryExpressionBuilder<TTables>;
	gt<TValue>(left: Expression<TValue, never>, right: Expression<TValue, never>): BinaryExpressionBuilder<TTables>;
	gt(...args: any[]): BinaryExpressionBuilder<TTables> {
		return new BinaryExpressionBuilder();
	}
	gte<TLeftIdentifier extends keyof Flatten<TTables>, TRightIdentifier extends keyof Flatten<TTables>>(
		left: TLeftIdentifier,
		right: Flatten<TTables>[TRightIdentifier] extends Flatten<TTables>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TTables>;
	gte<TIdentifier extends keyof Flatten<TTables>>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier], never>,
	): BinaryExpressionBuilder<TTables>;
	gte<TValue>(left: Expression<TValue, never>, right: Expression<TValue, never>): BinaryExpressionBuilder<TTables>;
	gte(...args: any[]): BinaryExpressionBuilder<TTables> {
		return new BinaryExpressionBuilder();
	}
	lt<TLeftIdentifier extends keyof Flatten<TTables>, TRightIdentifier extends keyof Flatten<TTables>>(
		left: TLeftIdentifier,
		right: Flatten<TTables>[TRightIdentifier] extends Flatten<TTables>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TTables>;
	lt<TIdentifier extends keyof Flatten<TTables>>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier], never>,
	): BinaryExpressionBuilder<TTables>;
	lt<TValue>(left: Expression<TValue, never>, right: Expression<TValue, never>): BinaryExpressionBuilder<TTables>;
	lt(...args: any[]): BinaryExpressionBuilder<TTables> {
		return new BinaryExpressionBuilder();
	}
	lte<TLeftIdentifier extends keyof Flatten<TTables>, TRightIdentifier extends keyof Flatten<TTables>>(
		left: TLeftIdentifier,
		right: Flatten<TTables>[TRightIdentifier] extends Flatten<TTables>[TLeftIdentifier] ? TRightIdentifier : never,
	): BinaryExpressionBuilder<TTables>;
	lte<TIdentifier extends keyof Flatten<TTables>>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier], never>,
	): BinaryExpressionBuilder<TTables>;
	lte<TValue>(left: Expression<TValue, never>, right: Expression<TValue, never>): BinaryExpressionBuilder<TTables>;
	lte(...args: any[]): BinaryExpressionBuilder<TTables> {
		return new BinaryExpressionBuilder();
	}
	// in
	// notIn
	// like
	// notLike
}

class BooleanExpressionBuilder<TTables> {
	and(
		left: BinaryExpressionBuilder<TTables> | BooleanExpressionBuilder<TTables>,
		right: BinaryExpressionBuilder<TTables> | BooleanExpressionBuilder<TTables>,
	): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	or(
		left: BinaryExpressionBuilder<TTables> | BooleanExpressionBuilder<TTables>,
		right: BinaryExpressionBuilder<TTables> | BooleanExpressionBuilder<TTables>,
	): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	not(expr: BinaryExpressionBuilder<TTables> | BooleanExpressionBuilder<TTables>): BooleanExpressionBuilder<TTables> {
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
	.where((q) => q.lte("p.postedAt", q.param("patate")))
	.groupBy(["u.id"])
	.having(".title", "notLike", "%Test%")
	.orderBy((q) => [q.column("p.postedAt").desc(), "p.title"])
	.limit(1);
