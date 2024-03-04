import { Value } from "../../lib/typebox.ts";
import { TypeGuard } from "npm:@sinclair/typebox@0.32.13/type";
import type {
	ContextDeriver,
	Method,
	RequestHandler,
	RouteSegment,
	RouteSegmentHandler,
} from "./types.ts";

export default function makeDynamicRouter(
	rst: RouteSegment[],
	context: Record<string, unknown>,
	// deno-lint-ignore no-explicit-any
	derivers: Array<ContextDeriver<any>>,
): RequestHandler {
	const [regexp, routes] = routeSegmentsToRegExp(rst);
	return async (request: Request) => {
		try {
			const url = new URL(request.url);
			const match = regexp.exec(`${url.pathname}#`);
			if (match) {
				const index = match.findIndex((m) => m === "#");
				const ops = routes.get(index);
				if (!ops) {
					return new Response(null, { status: 500 });
				}
				const method = request.method.toUpperCase() as Method;
				const op = ops[method];
				if (!op) {
					if (method === "OPTIONS") {
						const origin = request.headers.get("Origin");
						const headers = Object.values(ops).map(({ definition }) =>
							definition.headers
						).filter(TypeGuard.IsObject).flatMap((schema) =>
							Object.keys(schema.properties)
						).map((name) => name.toUpperCase()).join(", ");
						return new Response(null, {
							status: 204,
							headers: {
								"Access-Control-Allow-Origin": origin
									? new URL(origin).host
									: "*",
								"Access-Control-Allow-Methods": `${
									Object.keys(ops).join(", ")
								}, OPTIONS`,
								"Access-Control-Allow-Headers": headers === "" ? "*" : headers,
							},
						});
					} else {
						return new Response(null, {
							status: 405,
							headers: { Allow: `${Object.keys(ops).join(", ")}, OPTIONS` },
						});
					}
				}
				const params = match.groups ?? {};
				let body: Record<string, unknown> = {};
				const headers: Record<string, unknown> = Object.fromEntries(
					request.headers,
				);

				if (
					op.definition.headers &&
					!Value.Check(op.definition.headers, headers)
				) {
					return new Response(null, { status: 400 });
				}
				const query = Object.fromEntries(url.searchParams);
				if (
					op.definition.query && !Value.Check(op.definition.query, query)
				) {
					return new Response(null, { status: 400 });
				}
				if (op.definition.body) {
					const contentType = request.headers.get("Content-Type")
						?.toLowerCase();
					if (contentType?.startsWith("application/json")) {
						body = await request.json();
					} else if (contentType === "application/x-www-form-urlencoded") {
						body = Object.fromEntries(
							new URLSearchParams(await request.text()),
						);
					} else if (contentType === "multipart/form-data") {
						const form = await request.formData();
						body = Array.from(form.keys()).reduce((body, key) => {
							const values = form.getAll(key);
							body[key] = values.length === 1 ? values[0] : values;
							return body;
						}, {} as Record<string, unknown>);
					}
					if (!Value.Check(op.definition.body, body)) {
						return new Response(null, { status: 400 });
					}
				}

				const requestContext = { ...context };
				for (const derive of derivers) {
					Object.assign(
						requestContext,
						derive instanceof Function
							? await derive({ request, ...requestContext })
							: derive,
					);
				}
				return await op.handler({
					request,
					params,
					headers,
					query,
					body,
					...requestContext,
				});
			}
			return new Response(null, { status: 404 });
		} catch (error) {
			console.error(error);
			return new Response(null, { status: 500 });
		}
	};
}

/**
 * Transform a route segment into a regular expression.
 * @param segment
 */
function routeSegmentsToRegExp(
	segments: RouteSegment[],
): [RegExp, Map<number, RouteSegmentHandler["operations"]>] {
	const groups = new Map<number, RouteSegmentHandler["operations"]>();
	let index = 0;
	const regexp = new RegExp(`^${childrenToRegExp(segments)}$`);
	return [regexp, groups];
	function segmentToRegExp(segment: RouteSegment): string {
		if (segment.kind === "const") {
			// deno-fmt-ignore-line
			return `/${segment.value}${childrenToRegExp(segment.children)}`;
		} else if (segment.kind === "param") {
			index += 1;
			// deno-fmt-ignore-line
			return `/(?<${segment.name}>[^/]+)${childrenToRegExp(segment.children)}`;
		} else if (segment.kind === "rest") {
			index += 1;
			// deno-fmt-ignore-line
			return `/(?<${segment.name}>.+)?${childrenToRegExp(segment.children)}`;
		} else {
			index += 1;
			groups.set(index, segment.operations);
			return "(#)";
		}
	}
	function childrenToRegExp(children: RouteSegment[]): string {
		if (children.length === 0) {
			return "";
		}
		// deno-fmt-ignore-line
		return `(?:${children.map((c) => segmentToRegExp(c)).join("|")})`;
	}
}
