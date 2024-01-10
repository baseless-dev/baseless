import * as t from "../schema/types.ts";
import type { Pretty, Split } from "../system/types.ts";

export type PathNamedParameter<Value> = Value extends `{...${infer Name}}`
	? never
	: Value extends `{${infer Name}}` ? Name
	: never;
export type PathNamedRestParameter<Value> = Value extends `{...${infer Name}}`
	? Name
	: never;
export type ExtractPathParams<Value extends string> = Pretty<
	& { [key in PathNamedParameter<Split<Value, "/">[number]>]: string }
	& { [key in PathNamedRestParameter<Split<Value, "/">[number]>]: string[] }
>;
export type ExtractPathParamsAsSchema<Value extends string> = t.ObjectSchema<
	Pretty<
		& { [key in PathNamedParameter<Split<Value, "/">[number]>]: t.StringSchema }
		& {
			[key in PathNamedRestParameter<Split<Value, "/">[number]>]: t.ArraySchema<
				t.StringSchema
			>;
		}
	>
>;

export function ExtractParamsAsSchemaRuntime<const Value extends string>(
	path: Value,
): undefined | ExtractPathParamsAsSchema<Value> {
	let empty = true;
	const props: Record<string, t.StringSchema | t.ArraySchema<t.StringSchema>> =
		{};
	const required: string[] = [];
	for (const [, rest, param] of path.matchAll(/\{(\.\.\.)?(\w+)\}/g)) {
		empty = false;
		props[param] = rest ? t.Array(t.String()) : t.String();
		required.push(param);
	}
	if (empty) {
		return undefined;
	}
	return t.Object(props, required) as ExtractPathParamsAsSchema<Value>;
}

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

export type Handler<
	TArgs extends unknown[] = never,
	TParams extends Record<string, string | string[]> = never,
	TDefinition extends Definition = never,
> = (
	request: Request,
	context: {
		params: TParams;
		query: t.Infer<TDefinition["query"]>;
		body: t.Infer<TDefinition["body"]>;
	},
	...args: TArgs
) => Promise<Response> | Response;

export interface Definition {
	tags?: string[];
	summary?: string;
	description?: string;
	params?: t.Schema;
	headers?: t.Schema;
	body?: t.Schema;
	query?: t.Schema;
	response?: {
		[status: number]: {
			description?: string;
			content?: {
				[contentType: string]: {
					schema: t.Schema;
				};
			};
		};
	};
}
export type Operation = {
	handler: Handler;
	definition: Definition;
};

export type Operations = {
	[method: string]: Operation;
};

export type Routes = {
	[path: string]: Operations;
};

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
export type RouteSegmentRest = {
	kind: "rest";
	name: string;
	children: RouteSegmentHandler[];
};
export type RouteSegmentHandler = { kind: "handler"; definition: Operations };
export type RouteSegment =
	| RouteSegmentConst
	| RouteSegmentParam
	| RouteSegmentRest
	| RouteSegmentHandler;

export function isRouteSegmentSimilar(
	a: RouteSegment,
	b: RouteSegment,
): boolean {
	if (a.kind === "const" && b.kind === "const") {
		return a.value === b.value;
	} else if (a.kind === "param" && b.kind === "param") {
		return a.name === b.name;
	} else if (a.kind === "rest" && b.kind === "rest") {
		return a.name === b.name;
	} else if (a.kind === "handler" && b.kind === "handler") {
		return true;
	}
	return false;
}
