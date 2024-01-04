import { Check } from "../schema/mod.ts";
import type { Method, Router, Routes, RoutesEndpoint } from "./types.ts";

export function dynamicRouter(routes: Routes): Router {
	const regexRoutes: Array<[RegExp, RoutesEndpoint]> = [];
	for (const [path, endpoints] of Object.entries(routes)) {
		const regex = new RegExp(
			`^/${
				path.replace(/(^\/+)/, "").replace(
					/:(\w+)(\??)/g,
					(_, param, optional) => {
						if (optional === "?") {
							return `(?<${param}>\\w+)?`;
						}
						return `(?<${param}>\\w+)`;
					},
				)
			}$`,
		);
		regexRoutes.push([regex, endpoints]);
	}
	return async (
		request: Request,
	): Promise<[Response, Array<PromiseLike<unknown>>]> => {
		try {
			const url = new URL(request.url);
			const method = request.method.toUpperCase() as Method;
			for (const [regex, endpoints] of regexRoutes) {
				const match = url.pathname.match(regex);
				if (match) {
					const endpoint = endpoints[method];
					if (endpoint) {
						const params = (match.groups ?? {}) as Record<string, never>;
						let query = {};
						let body = {};
						if (endpoint.schemas.params) {
							if (!Check(endpoint.schemas.params, params)) {
								return [new Response(null, { status: 400 }), []];
							}
						}
						if (endpoint.schemas.query) {
							query = Object.fromEntries(url.searchParams);
							if (!Check(endpoint.schemas.query, query)) {
								return [new Response(null, { status: 400 }), []];
							}
						}
						if (endpoint.schemas.body) {
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
							if (!Check(endpoint.schemas.body, body)) {
								return [new Response(null, { status: 400 }), []];
							}
						}
						const response = await endpoint.handler(request, {
							params,
							query,
							body,
						});
						return [response, []];
					} else if (method === "OPTIONS") {
						const origin = request.headers.get("Origin");
						const response = new Response(null, {
							status: 204,
							headers: {
								"Access-Control-Allow-Origin": origin
									? new URL(origin).host
									: "*",
								"Access-Control-Allow-Methods": Object.keys(endpoints).join(
									", ",
								),
								"Access-Control-Allow-Headers": "*",
							},
						});
						return [response, []];
					} else {
						const response = new Response(null, {
							status: 405,
							headers: { Allow: Object.keys(endpoints).join(", ") },
						});
						return [response, []];
					}
				}
			}
			return [new Response(null, { status: 404 }), []];
		} catch (error) {
			console.error(error);
			return [new Response(null, { status: 500 }), []];
		}
	};
}
