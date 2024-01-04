import { Check } from "../schema/schema.ts";
import type { Handler, Router, RouteSchema, RouteSegment } from "./types.ts";

export function compileRouter(rst: RouteSegment[]): Router {
	const { code, handlers, schemas } = getRouterCode(rst);
	return Function("data", code)({ handlers, schemas, Check });
}

export function getRouterCode(
	rst: RouteSegment[],
): { code: string; handlers: Handler[]; schemas: RouteSchema[] } {
	const handlers: Handler[] = [];
	const schemas: RouteSchema[] = [];

	// deno-fmt-ignore
	const code = `const { handlers, schemas, Check } = data;
	return async function router(request) {
	  try {
	    const url = new URL(request.url);
	    const segments = url.pathname.slice(1).split("/");
	    const method = request.method.toUpperCase();
	    const params = {};
      
	    ${rst.map(segment => codeForRouteSegment(segment, 0, handlers, schemas, 3)).join(`\n      `)}
	    return [new Response(null, { status: 404 }), []];
	  } catch (error) {
	    console.error(error);
	    return [new Response(null, { status: 500 }), []];
	  }
	}`.replace(/\n\t*/g, `\n`);

	return { code, handlers, schemas };
}

function codeForRouteSegment(
	segment: RouteSegment,
	index: number,
	handlers: Handler[],
	schemas: RouteSchema[],
	lvl = 0,
): string {
	const eol = `\n` + "  ".repeat(lvl);
	if (segment.kind === "const") {
		return `if (segments[${index}] === "${segment.value}") {${eol}  ${
			segment.children.map((segment) =>
				codeForRouteSegment(
					segment,
					index + 1,
					handlers,
					schemas,
					lvl + 1,
				)
			).join(`${eol}  `)
		}${eol}}${eol}${eol}`;
	} else if (segment.kind === "param") {
		const ieol = eol + (segment.optional ? "" : "  ");
		const ilvl = lvl + (segment.optional ? 0 : 1);
		// deno-fmt-ignore
		return `${!segment.optional ? `if (segments[${index}]) {` : ``}${ieol}params["${segment.name}"] = segments[${index}];${ieol}${
			segment.children.map((segment) =>
				codeForRouteSegment(
					segment,
					index + 1,
					handlers,
					schemas,
					ilvl,
				)
			).join('')
		}${ieol}delete params["${segment.name}"];${eol}${!segment.optional ? `}` : ``}${eol}`;
	} else if (segment.kind === "handler") {
		let first = true;
		let code = ``;
		for (const [method, handler] of Object.entries(segment.methods)) {
			const id = handlers.length;
			handlers.push(handler.handler);
			schemas.push(handler.schemas);
			// deno-fmt-ignore
			code += `${!first ? `else ` : ``}if (method === "${method}") {
			  let body = {};
			  ${handler.schemas.params
				? `if (!Check(schemas[${id}].params, params)) { return [new Response(null, { status: 400 }), []] }`
				: ``}
			  const query = Object.fromEntries(url.searchParams);
			  ${handler.schemas.query
				? `if (!Check(schemas[${id}].query, query)) { return [new Response(null, { status: 400 }), []] }`
				: ``}
			  ${handler.schemas.body
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
				  if (!Check(schemas[${id}].body, body)) { return [new Response(null, { status: 400 }), []] }`
			    : ``}
			  const response = await handlers[${id}](request, { params, query, body });
			  return [response, []];
			}`.replace(/\n\t*/g, eol)+eol;
			first = false;
		}
		if (!("OPTIONS" in segment.methods)) {
			// deno-fmt-ignore
			code += `else if (method === "OPTIONS") {
			  const origin = request.headers.get("Origin");
			  const response = new Response(null, {
			    status: 204,
			    headers: {
			      "Access-Control-Allow-Origin": origin ? new URL(origin).host : "*",
			      "Access-Control-Allow-Methods": "${Object.keys(segment.methods).join(", ")}, OPTIONS",
			      "Access-Control-Allow-Headers": "*",
			    },
			  });
			  return [response, []];
			}`.replace(/\n\t*/g, eol)+eol;
		}
		if (!first) {
			// deno-fmt-ignore
			code += `else {
			  const response = new Response(null, {
			    status: 405,
			    headers: { Allow: "${Object.keys(segment.methods).join(", ")}, OPTIONS" },
			  });
			  return [response, []];
			}`.replace(/\n\t*/g, eol)+eol;
		}
		return code;
	}
	return ``;
}
