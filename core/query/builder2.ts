// deno-lint-ignore-file no-explicit-any ban-types
type Prettify<T> = { [K in keyof T]: T[K] } & {};

type UnionToTuple<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I[] : never;

type Flatten<T> = {
	[
		DK in {
			[K in keyof T & string]: `${K}.${keyof T[K] & string}`;
		}[keyof T & string]
	]: DK extends `${infer K}.${infer F}` ? K extends keyof T ? F extends keyof T[K] ? T[K][F]
			: never
		: never
		: never;
};

type LastIdentifier<T extends string> = T extends `${infer _}.${infer Rest}` ? LastIdentifier<Rest> : T;

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

class Expression<TOutput> {
	#private!: "expr";
}

class ExpressionBuilder<TTables, TFrom, TOutput> {
	literal<TLiteral extends string | number | boolean | null>(value: TLiteral): Expression<TLiteral> {
		return new Expression();
	}
	column<TIdentifier extends keyof Flatten<TFrom>>(column: TIdentifier): Expression<Flatten<TFrom>[TIdentifier]> {
		return new Expression();
	}
	select<TSelectOutput>(
		builder: (q: RootQueryBuilder<TTables>) => SelectQueryBuilder<TTables, TFrom, TSelectOutput, any>,
	): Expression<TSelectOutput> {
		return new Expression();
	}
	fn<TReturn>(name: string, ...args: Expression<any>[]): Expression<TReturn> {
		return new Expression();
	}
}

class SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
	select<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
	): SelectQueryBuilder<TTables, TFrom, Prettify<TOutput & { [P in LastIdentifier<TIdentifier>]: Flatten<TFrom>[TIdentifier] }>, TSingle>;
	select<TAlias extends string, TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
		alias: TAlias,
	): SelectQueryBuilder<TTables, TFrom, Prettify<TOutput & { [P in TAlias]: Flatten<TFrom>[TIdentifier] }>, TSingle>;
	select<TAlias extends string, TReturn>(
		alias: TAlias,
		builder: (q: ExpressionBuilder<TTables, TFrom, any>) => Expression<TReturn>,
	): SelectQueryBuilder<TTables, TFrom, Prettify<TOutput & { [P in TAlias]: TReturn }>, TSingle>;
	select(...args: any[]): SelectQueryBuilder<any, any, any, any> {
		return new SelectQueryBuilder();
	}
	leftJoin<TName extends keyof TTables>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>
				& BooleanExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>,
		) =>
			| BinaryExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>
			| BooleanExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>,
	): SelectQueryBuilder<TTables, TFrom & { [K in TName]: TTables[TName] }, TOutput, TSingle>;
	leftJoin<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>
				& BooleanExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>,
		) =>
			| BinaryExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>
			| BooleanExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>,
	): SelectQueryBuilder<TTables, TFrom & { [K in TAlias]: TTables[TName] }, TOutput, TSingle>;
	leftJoin(...args: any[]): SelectQueryBuilder<any, any, any, any> {
		return new SelectQueryBuilder();
	}
	rightJoin<TName extends keyof TTables>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>
				& BooleanExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>,
		) =>
			| BinaryExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>
			| BooleanExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>,
	): SelectQueryBuilder<TTables, TFrom & { [K in TName]: TTables[TName] }, TOutput, TSingle>;
	rightJoin<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>
				& BooleanExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>,
		) =>
			| BinaryExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>
			| BooleanExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>,
	): SelectQueryBuilder<TTables, TFrom & { [K in TAlias]: TTables[TName] }, TOutput, TSingle>;
	rightJoin(...args: any[]): SelectQueryBuilder<any, any, any, any> {
		return new SelectQueryBuilder();
	}
	innerJoin<TName extends keyof TTables>(
		table: TName,
		on: (
			q:
				& BinaryExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>
				& BooleanExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>,
		) =>
			| BinaryExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>
			| BooleanExpressionBuilder<TFrom & { [K in TName]: TTables[TName] }>,
	): SelectQueryBuilder<TTables, TFrom & { [K in TName]: TTables[TName] }, TOutput, TSingle>;
	innerJoin<TName extends keyof TTables, TAlias extends string>(
		table: TName,
		alias: TAlias,
		on: (
			q:
				& BinaryExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>
				& BooleanExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>,
		) =>
			| BinaryExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>
			| BooleanExpressionBuilder<TFrom & { [K in TAlias]: TTables[TName] }>,
	): SelectQueryBuilder<TTables, TFrom & { [K in TAlias]: TTables[TName] }, TOutput, TSingle>;
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
			q: BinaryExpressionBuilder<TFrom> & BooleanExpressionBuilder<TFrom>,
		) => BinaryExpressionBuilder<TFrom> | BooleanExpressionBuilder<TFrom>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	where(...args: any[]): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
		return new SelectQueryBuilder();
	}
	groupBy<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
	): SelectQueryBuilder<TTables, TFrom, Prettify<TOutput & { [P in LastIdentifier<TIdentifier>]: Flatten<TFrom>[TIdentifier] }>, TSingle> {
		return new SelectQueryBuilder();
	}
	having<TIdentifier extends keyof Flatten<{ "": TOutput }>>(
		column: TIdentifier,
		op: BinaryOperator,
		value: Flatten<{ "": TOutput }>[TIdentifier],
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	having(
		builder: (
			q: BinaryExpressionBuilder<{ "": TOutput }> & BooleanExpressionBuilder<{ "": TOutput }>,
		) => BinaryExpressionBuilder<{ "": TOutput }> | BooleanExpressionBuilder<{ "": TOutput }>,
	): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle>;
	having(...args: any[]): SelectQueryBuilder<TTables, TFrom, TOutput, TSingle> {
		return new SelectQueryBuilder();
	}
	orderBy<TIdentifier extends keyof Flatten<TFrom>>(
		column: TIdentifier,
		direction: "ASC" | "DESC" = "ASC",
	): SelectQueryBuilder<TTables, TFrom, Prettify<TOutput & { [P in LastIdentifier<TIdentifier>]: Flatten<TFrom>[TIdentifier] }>, TSingle> {
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
		value: Flatten<TTables>[TIdentifier],
	): BinaryExpressionBuilder<TTables>;
	eq<TIdentifier extends keyof Flatten<TTables>>(
		column: TIdentifier,
		expr: Expression<Flatten<TTables>[TIdentifier]>,
	): BinaryExpressionBuilder<TTables>;
	eq<TValue>(left: Expression<TValue>, right: Expression<TValue>): BinaryExpressionBuilder<TTables>;
	eq(...args: any[]): BinaryExpressionBuilder<TTables> {
		return new BinaryExpressionBuilder();
	}
	/*ne<TIdentifier extends keyof Flatten<TTables>>(column: TIdentifier, value: Flatten<TTables>[TIdentifier]): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	gt<TIdentifier extends keyof Flatten<TTables>>(column: TIdentifier, value: Flatten<TTables>[TIdentifier]): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	gte<TIdentifier extends keyof Flatten<TTables>>(column: TIdentifier, value: Flatten<TTables>[TIdentifier]): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	lt<TIdentifier extends keyof Flatten<TTables>>(column: TIdentifier, value: Flatten<TTables>[TIdentifier]): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	lte<TIdentifier extends keyof Flatten<TTables>>(column: TIdentifier, value: Flatten<TTables>[TIdentifier]): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	in<TIdentifier extends keyof Flatten<TTables>, TValues extends Flatten<TTables>[TIdentifier][]>(column: TIdentifier, values: TValues): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	notIn<TIdentifier extends keyof Flatten<TTables>, TValues extends Flatten<TTables>[TIdentifier][]>(column: TIdentifier, values: TValues): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	like<TIdentifier extends keyof Flatten<TTables>>(column: TIdentifier, pattern: string): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}
	notLike<TIdentifier extends keyof Flatten<TTables>>(column: TIdentifier, pattern: string): BooleanExpressionBuilder<TTables> {
		return new BooleanExpressionBuilder();
	}*/
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
	.selectFrom("users", "u")
	.innerJoin("posts", "p", (q) => q.eq("u.id", "p.authorId"))
	.select("u.id")
	.select("u.name")
	.select("title", (q) => q.column("p.title"))
	.where("u.id", "=", 123)
	.groupBy("u.id")
	.having(".id", ">", 10)
	.having((q) => q.eq(".title", "Hello World"))
	.orderBy("p.postedAt", "DESC")
	.limit(1);
