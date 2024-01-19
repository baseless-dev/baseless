import { Check } from "../schema/schema.ts";
import type { MaybeCallable, MaybePromise } from "../system/types.ts";
import type { Method, Operations, RequestHandler, Routes } from "./types.ts";

export function dynamicRouter<TArgs extends {}>(
	routes: Routes,
	decorations: Array<
		MaybeCallable<MaybePromise<Record<string, unknown>>, [{ request: Request }]>
	>,
): RequestHandler<TArgs> {
	throw "TODO!";
	// const regexRoutes: Array<[RegExp, Operations]> = [];
	// for (const [path, endpoints] of Object.entries(routes)) {
	// 	const regex = new RegExp(
	// 		`^/${
	// 			path
	// 				.replace(/(^\/+|\/+$)/, "")
	// 				.replace(/:(\w+)/g, "(?<$1>\\w+)")
	// 		}$`,
	// 	);
	// 	regexRoutes.push([regex, endpoints]);
	// }
	// return async (
	// 	request: Request,
	// 	...args: Args
	// ): Promise<Response> => {
	// 	try {
	// 		const url = new URL(request.url);
	// 		const method = request.method.toUpperCase() as Method;
	// 		for (const [regex, endpoints] of regexRoutes) {
	// 			const match = url.pathname.match(regex);
	// 			if (match) {
	// 				const endpoint = endpoints[method];
	// 				if (endpoint) {
	// 					const params = (match.groups ?? {}) as Record<string, never>;
	// 					let query = {};
	// 					let body = {};
	// 					if (endpoint.definition.params) {
	// 						if (!Check(endpoint.definition.params, params)) {
	// 							return new Response(null, { status: 400 });
	// 						}
	// 					}
	// 					if (endpoint.definition.query) {
	// 						query = Object.fromEntries(url.searchParams);
	// 						if (!Check(endpoint.definition.query, query)) {
	// 							return new Response(null, { status: 400 });
	// 						}
	// 					}
	// 					if (endpoint.definition.body) {
	// 						const contentType = request.headers.get("Content-Type")
	// 							?.toLowerCase();
	// 						if (contentType?.startsWith("application/json")) {
	// 							body = await request.json();
	// 						} else if (contentType === "application/x-www-form-urlencoded") {
	// 							body = Object.fromEntries(
	// 								new URLSearchParams(await request.text()),
	// 							);
	// 						} else if (contentType === "multipart/form-data") {
	// 							const form = await request.formData();
	// 							body = Array.from(form.keys()).reduce((body, key) => {
	// 								const values = form.getAll(key);
	// 								body[key] = values.length === 1 ? values[0] : values;
	// 								return body;
	// 							}, {} as Record<string, unknown>);
	// 						}
	// 						if (!Check(endpoint.definition.body, body)) {
	// 							return new Response(null, { status: 400 });
	// 						}
	// 					}
	// 					return await endpoint.handler(request, {
	// 						params,
	// 						query,
	// 						body,
	// 					});
	// 				} else if (method === "OPTIONS") {
	// 					const origin = request.headers.get("Origin");
	// 					return new Response(null, {
	// 						status: 204,
	// 						headers: {
	// 							"Access-Control-Allow-Origin": origin
	// 								? new URL(origin).host
	// 								: "*",
	// 							"Access-Control-Allow-Methods": Object.keys(endpoints).join(
	// 								", ",
	// 							),
	// 							"Access-Control-Allow-Headers": "*",
	// 						},
	// 					});
	// 				} else {
	// 					return new Response(null, {
	// 						status: 405,
	// 						headers: { Allow: Object.keys(endpoints).join(", ") },
	// 					});
	// 				}
	// 			}
	// 		}
	// 		return new Response(null, { status: 404 });
	// 	} catch (error) {
	// 		console.error(error);
	// 		return new Response(null, { status: 500 });
	// 	}
	// };
}
