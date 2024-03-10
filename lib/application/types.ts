// deno-lint-ignore-file no-explicit-any ban-types
import {
	type Static,
	t,
	TArray,
	TObject,
	type TSchema,
	TString,
} from "../typebox.ts";
import type { MaybeCallable, MaybePromise, Pretty, Split } from "../types.ts";

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
	TContext extends Record<string, unknown> = any,
	TParams extends Record<string, string | string[]> = any,
	TDefinition extends Definition<any, any, any, any> = any,
> = (
	context: {
		request: Request;
		params: TParams;
		headers: Static<TDefinition["headers"]>;
		query: Static<TDefinition["query"]>;
		body: Static<TDefinition["body"]>;
	} & TContext,
) => Promise<Response> | Response;

export interface Definition<
	TParams extends TSchema,
	THeaders extends TSchema,
	TBody extends TSchema,
	TQuery extends TSchema,
> {
	detail?: {
		tags?: string[];
		summary?: string;
		description?: string;
	};
	params?: TParams;
	headers?: THeaders;
	body?: TBody;
	query?: TQuery;
	response?: {
		[status: number]: {
			description?: string;
			content?: {
				[contentType: string]: {
					schema: TSchema;
				};
			};
		};
	};
}

export type Route = {
	path: string;
	method: Method;
	handler: Handler;
	definition: Definition<any, any, any, any>;
};

export type Routes = Route[];

export type ContextDecorator<T extends Record<string, unknown>> = MaybeCallable<
	MaybePromise<T>
>;

export type ContextDeriver<
	T extends Record<string, unknown>,
	TContext extends {},
> = MaybeCallable<
	MaybePromise<T>,
	[{ request: Request } & TContext]
>;

export type RequestHandler = (request: Request) => Promise<Response>;

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
export type RouteSegmentHandler = {
	kind: "handler";
	operations: {
		[method in Method]?: {
			handler: Handler;
			definition: Definition<any, any, any, any>;
		};
	};
};
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

// deno-fmt-ignore
type ExtractPathParamsFromSegments<T extends unknown[]> =
	T extends [infer Head, ...infer Tail]
		? [PathNamedParameter<Head>] extends [never]
			? [PathNamedRestParameter<Head>] extends [never]
				? [...ExtractPathParamsFromSegments<Tail>]
				: [PathNamedRestParameter<Head>, ...ExtractPathParamsFromSegments<Tail>]
			: [PathNamedParameter<Head>, ...ExtractPathParamsFromSegments<Tail>]
		: [];

export type ExtractPathParamsAsSchema<Value extends string> = TObject<
	Pretty<
		& { [key in PathNamedParameter<Split<Value, "/">[number]>]: TString }
		& {
			[key in PathNamedRestParameter<Split<Value, "/">[number]>]: TArray<
				TString
			>;
		}
	>
>;

export function ExtractParamsAsSchemaRuntime<const Value extends string>(
	path: Value,
): undefined | ExtractPathParamsAsSchema<Value> {
	let empty = true;
	const props: Record<string, TString | TArray<TString>> = {};
	const required: string[] = [];
	for (const [, rest, param] of path.matchAll(/\{(\.\.\.)?(\w+)\}/g)) {
		empty = false;
		props[param] = rest ? t.Array(t.String()) : t.String();
		required.push(param);
	}
	if (empty) {
		return undefined;
	}
	return t.Object(props) as any;
}
