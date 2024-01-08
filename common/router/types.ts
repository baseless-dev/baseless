import * as t from "../schema/types.ts";
import type { Pretty } from "../system/types.ts";

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
export type NamedGroups<Segment> = Segment extends `:${infer Name}?` ? never
	: Segment extends `:${infer Name}` ? Name
	: never;
export type ExtractNamedGroupsFromPath<Path> = Path extends
	`${infer A}/${infer B}` ? NamedGroups<A> | ExtractNamedGroupsFromPath<B>
	: NamedGroups<Path>;
export type ExtractNamedGroupsFromAbsolutePath<Path> = Path extends
	`/${infer A}` ? ExtractNamedGroupsFromPath<A> : never;
export type ExtractParams<Path> = Pretty<
	{ [Key in ExtractNamedGroupsFromAbsolutePath<Path>]: string }
>;
export type ExtractParamsAsSchema<Path> = t.ObjectSchema<
	{ [Key in ExtractNamedGroupsFromAbsolutePath<Path>]: t.StringSchema },
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

export type Handler<
	Args extends unknown[] = [],
	Params extends Record<string, never> = Record<string, never>,
	Input extends OperationDefinition = {},
> = (
	request: Request,
	context: {
		params: Params;
		query: t.Infer<Input["query"]>;
		body: t.Infer<Input["body"]>;
	},
	...args: Args
) => Promise<Response> | Response;

export type Endpoint = {
	handler: Handler;
	definition: OperationDefinition;
};
export type Operations = {
	[method in Method]?: Endpoint;
};

export type Routes = Record<string, Operations>;

export interface OperationDefinition {
	tags?: string[];
	summary?: string;
	description?: string;
	params?: t.Schema;
	body?: t.Schema;
	query?: t.Schema;
	response?: Record<string, t.Schema>;
}

export type RequestHandler<Args extends unknown[]> = (
	request: Request,
	...args: Args
) => Promise<Response>;

export type RouteSegmentConst = {
	kind: "const";
	value: string;
	children: RouteSegment[];
};
export type RouteSegmentParam = {
	kind: "param";
	name: string;
	children: RouteSegment[];
};
export type RouteSegmentHandler = { kind: "handler"; operations: Operations };
export type RouteSegment =
	| RouteSegmentConst
	| RouteSegmentParam
	| RouteSegmentHandler;

export function isRouteSegmentSimilar(
	a: RouteSegment,
	b: RouteSegment,
): boolean {
	if (a.kind === "const" && b.kind === "const") {
		return a.value === b.value;
	} else if (a.kind === "param" && b.kind === "param") {
		return a.name === b.name;
	} else if (a.kind === "handler" && b.kind === "handler") {
		return true;
	}
	return false;
}
