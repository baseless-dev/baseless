import * as t from "../schema/types.ts";

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
export type ExtractParamsAsSchema<Path> = t.ObjectSchema<
	Pretty<
		& { [Key in ExtractNamedGroupsFromAbsolutePath<Path>]: t.StringSchema }
		& {
			[Key in ExtractOptionalNamedGroupsFromAbsolutePath<Path>]?:
				t.StringSchema;
		}
	>,
	Array<ExtractNamedGroupsFromAbsolutePath<Path>>
>;

export function ExtractParamsAsSchemaRuntime<const Path extends string>(
	path: Path,
): undefined | ExtractParamsAsSchema<Path> {
	let empty = true;
	const props: Record<string, t.StringSchema> = {};
	const required: string[] = [];
	for (const [, param, optional] of path.matchAll(/:(\w+)(\??)/g)) {
		empty = false;
		props[param] = t.String();
		if (optional === "") {
			required.push(param);
		}
	}
	if (empty) {
		return undefined;
	}
	return t.Object(props, required) as ExtractParamsAsSchema<Path>;
}

export type Pretty<U> = U extends infer O ? { [K in keyof O]: O[K] }
	: never;

export type Handler<
	Args extends unknown[] = [],
	Params extends Record<string, never> = Record<string, never>,
	Input extends InputSchema = {},
> = (
	request: Request,
	context: {
		params: Params;
		query: t.Infer<Input["query"]>;
		body: t.Infer<Input["body"]>;
	},
	...args: Args
) => Promise<Response> | Response;

export type RouteBase = {
	[path: string]: {
		[method: string]: {
			handler: Handler;
			schemas: RouteSchema;
		};
	};
};

export interface InputSchema {
	body?: t.Schema;
	query?: t.Schema;
	response?: t.Schema;
}

export interface RouteSchema {
	body?: t.Schema;
	query?: t.Schema;
	params?: t.Schema;
	response?: t.Schema;
}
