import { Check } from "../schema/schema.ts";
import { isObjectSchema } from "../schema/types.ts";
import type { MaybeCallable, MaybePromise } from "../system/types.ts";
import type {
	Definition,
	Handler,
	RequestHandler,
	RouteSegment,
} from "./types.ts";

export function compileRouter(
	rst: RouteSegment[],
	decorations: Array<
		MaybeCallable<MaybePromise<Record<string, unknown>>, [{ request: Request }]>
	>,
): RequestHandler {
	const { code, handlers, definitions } = getRouterCode(rst);
	return Function("data", code)({ handlers, definitions, decorations, Check });
}

export function getRouterCode(
	rst: RouteSegment[],
): { code: string; handlers: Handler[]; definitions: Definition[] } {
	const handlers: Handler[] = [];
	const definitions: Definition[] = [];

	// deno-fmt-ignore
	const code = `const { handlers, definitions, decorations, Check } = data;
	return async function router(request) {
	  try {
	    const context = {};
	    for (const decoration of decorations) {
	      Object.assign(context, decoration instanceof Promise || decoration instanceof Function ? await decoration({ request, ...context }) : decoration);
	    }
	    const url = new URL(request.url);
	    const segments = url.pathname.slice(1).split("/");
	    const method = request.method.toUpperCase();
	    const params = {};
	    
	    ${rst.map(segment => codeForRouteSegment(segment, 0, handlers, definitions, 2)).join(`\n    `)}
	    return new Response(null, { status: 404 });
	  } catch (error) {
	    console.error(error);
	    return new Response(null, { status: 500 });
	  }
	}`.replace(/\n\t*/g, `\n`);

	return { code, handlers, definitions };
}

function codeForRouteSegment(
	segment: RouteSegment,
	index: number,
	handlers: Handler[],
	definitions: Definition[],
	lvl = 0,
	catchRestParam = false,
): string {
	const eol = `\n` + "  ".repeat(lvl);
	if (segment.kind === "const") {
		return `if (segments[${index}] === "${segment.value}") {${eol}  ${
			segment.children.map((segment) =>
				codeForRouteSegment(
					segment,
					index + 1,
					handlers,
					definitions,
					lvl + 1,
				)
			).join(``)
		}${eol}}${eol}`;
	} else if (segment.kind === "rest") {
		// deno-fmt-ignore
		return `params["${segment.name}"] = segments.slice(${index});${eol}${
			segment.children.map((segment) =>
				codeForRouteSegment(
					segment,
					index + 1,
					handlers,
					definitions,
					lvl,
					true,
				)
			).join(`${eol}`)
		}${eol}delete params["${segment.name}"];${eol}`;
	} else if (segment.kind === "param") {
		// deno-fmt-ignore
		return `if (segments[${index}]) {${eol}  params["${segment.name}"] = segments[${index}];${eol}  ${
			segment.children.map((segment) =>
				codeForRouteSegment(
					segment,
					index + 1,
					handlers,
					definitions,
					lvl + 1,
				)
			).join(`${eol}  `)
		}${eol}  delete params["${segment.name}"];${eol}}${eol}`;
	} else if (segment.kind === "handler") {
		let first = true;
		const ieol = catchRestParam ? eol : `${eol}  `;
		let code = ``;
		if (!catchRestParam) {
			code += `if (segments.length === ${index}) {${ieol}`;
		}
		for (const [method, handler] of Object.entries(segment.definition)) {
			const id = handlers.length;
			handlers.push(handler.handler);
			definitions.push(handler.definition);
			// deno-fmt-ignore
			code += `${!first ? `else ` : ``}if (method === "${method}") {
			  let body = {};
			  const headers = Object.fromEntries(request.headers);

			  ${handler.definition.headers
				? `if (!Check(definitions[${id}].headers, headers)) { return new Response(null, { status: 400 }); }`
				: ``}
			  ${handler.definition.params
				? `if (!Check(definitions[${id}].params, params)) { return new Response(null, { status: 400 }); }`
				: ``}
			  const query = Object.fromEntries(url.searchParams);
			  ${handler.definition.query
				? `if (!Check(definitions[${id}].query, query)) { return new Response(null, { status: 400 }); }`
				: ``}
			  ${handler.definition.body
			    ? `const contentType = request.headers.get("Content-Type")?.toLowerCase();
				  if (contentType?.startsWith("application/json")) {
				    body = await request.json();
				  }
				  else if (contentType === "application/x-www-form-urlencoded") {
				    body = Object.fromEntries(new URLSearchParams(await request.text()));
				  }
				  else if (contentType === "multipart/form-data") {
				    body = Array.from(form.keys()).reduce((body, key) => {
				      const values = form.getAll(key);
				      body[key] = values.length === 1 ? values[0] : values;
				      return body;
				    }, {});
				  }
				  if (!Check(definitions[${id}].body, body)) { return new Response(null, { status: 400 }); }`
			    : ``}
			  return await handlers[${id}]({ request, params, headers, query, body, ...context });
			}`.replace(/\n\t*/g, ieol)+ieol;
			first = false;
		}
		if (!("OPTIONS" in segment.definition)) {
			const headers = Object.values(segment.definition).map(({ definition }) =>
				definition.headers
			).filter(isObjectSchema).flatMap((schema) =>
				Object.keys(schema.properties)
			).map((name) => name.toUpperCase()).join(", ");
			// deno-fmt-ignore
			code += `else if (method === "OPTIONS") {
			  const origin = request.headers.get("Origin");
			  return new Response(null, {
			    status: 204,
			    headers: {
			      "Access-Control-Allow-Origin": origin ? new URL(origin).host : "*",
			      "Access-Control-Allow-Methods": "${Object.keys(segment.definition).join(", ")}, OPTIONS",
			      "Access-Control-Allow-Headers": "${headers}",
			    },
			  });
			}`.replace(/\n\t*/g, ieol)+ieol;
		}
		if (!first) {
			// deno-fmt-ignore
			code += `else {
			  return new Response(null, {
			    status: 405,
			    headers: { Allow: "${Object.keys(segment.definition).join(", ")}, OPTIONS" },
			  });
			}`.replace(/\n\t*/g, ieol)+ieol;
		}
		if (!catchRestParam) {
			code += `${eol}}${eol}`;
		}
		return code;
	}
	return ``;
}
