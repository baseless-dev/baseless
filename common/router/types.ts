import type {
	Infer,
	ObjectSchema,
	Schema,
	StringSchema,
} from "../schema/types.ts";

export type Method =
	| "CONNECT"
	| "DELETE"
	| "GET"
	| "HEAD"
	| "PATCH"
	| "POST"
	| "PUT"
	| "OPTIONS"
	| "TRACE";

export type AbsolutePath<Path> = Path extends `/${infer A}` ? Path : never;
export type OptionalNamedGroups<Segment> = Segment extends `:${infer Name}?`
	? Name
	: never;
export type NamedGroups<Segment> = Segment extends `:${infer Name}?` ? never
	: Segment extends `:${infer Name}` ? Name
	: never;
export type ExtractNamedGroupsFromPath<Path> = Path extends
	`${infer A}/${infer B}` ? NamedGroups<A> | ExtractNamedGroupsFromPath<B>
	: NamedGroups<Path>;
export type ExtractNamedGroupsFromAbsolutePath<Path> = Path extends
	`/${infer A}` ? ExtractNamedGroupsFromPath<A> : never;
export type ExtractOptionalNamedGroupsFromPath<Path> = Path extends
	`${infer A}/${infer B}`
	? NamedGroups<A> | ExtractOptionalNamedGroupsFromPath<B>
	: OptionalNamedGroups<Path>;
export type ExtractOptionalNamedGroupsFromAbsolutePath<Path> = Path extends
	`/${infer A}` ? ExtractOptionalNamedGroupsFromPath<A> : never;
export type ExtractParams<Path> = Pretty<
	& { [Key in ExtractNamedGroupsFromAbsolutePath<Path>]: string }
	& {
		[Key in ExtractOptionalNamedGroupsFromAbsolutePath<Path>]?: string;
	}
>;
export type ExtractParamsAsSchema<Path> = ObjectSchema<
	Pretty<
		& { [Key in ExtractNamedGroupsFromAbsolutePath<Path>]: StringSchema }
		& {
			[Key in ExtractOptionalNamedGroupsFromAbsolutePath<Path>]?: StringSchema;
		}
	>,
	Array<ExtractNamedGroupsFromAbsolutePath<Path>>
>;

export type Pretty<U> = U extends infer O ? { [K in keyof O]: O[K] }
	: never;

export type Handler<
	Args extends unknown[],
	Input extends InputSchema,
> = (
	request: Request,
	context: {
		params: Infer<Input["params"]>;
		query: Infer<Input["query"]>;
		body: Infer<Input["body"]>;
	},
	...args: Args
) => Promise<Response> | Response;

export type RouteBase = {
	[path: string]: {
		[method: string]: {
			handler: Handler<unknown[], InputSchema>;
			schemas: RouteSchema;
		};
	};
};

export interface InputSchema {
	body?: Schema;
	query?: Schema;
	params?: unknown;
	response?: Schema;
}

export interface RouteSchema {
	body?: unknown;
	query?: unknown;
	params?: unknown;
	response?: unknown;
}
