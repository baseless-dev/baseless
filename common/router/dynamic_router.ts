import { Check } from "../schema/schema.ts";
import { isObjectSchema } from "../schema/types.ts";
import type { MaybeCallable, MaybePromise } from "../system/types.ts";
import type {
	Method,
	Operations,
	RequestHandler,
	RouteSegment,
} from "./types.ts";

export function dynamicRouter<TArgs extends {}>(
	rst: RouteSegment[],
	decorations: Array<
		MaybeCallable<
			MaybePromise<Record<string, unknown>>,
			[{ request: Request }, TArgs]
		>
	>,
): RequestHandler<TArgs> {
	const [regexp, routes] = routeSegmentsToRegExp(rst);
	return async (request: Request, args: TArgs) => {
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
						).filter(isObjectSchema).flatMap((schema) =>
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
								"Access-Control-Allow-Headers": headers,
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
					!Check(op.definition.headers, headers)
				) {
					return new Response(null, { status: 400 });
				}
				const query = Object.fromEntries(url.searchParams);
				if (
					op.definition.query && !Check(op.definition.query, query)
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
					if (!Check(op.definition.body, body)) {
						return new Response(null, { status: 400 });
					}
				}

				const context = {};
				for (const decoration of decorations) {
					Object.assign(
						context,
						decoration instanceof Function
							? await decoration({ request, ...context }, args)
							: decoration,
					);
				}
				return await (op.handler as any)({
					request,
					params,
					headers,
					query,
					body,
					...context,
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
): [RegExp, Map<number, Operations>] {
	const groups = new Map<number, Operations>();
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
			return `/(?<${segment.name}>([^/]+)?)${childrenToRegExp(segment.children)}`;
		} else {
			index += 1;
			groups.set(index, segment.definition);
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
