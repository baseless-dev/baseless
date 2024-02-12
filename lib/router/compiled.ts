// deno-lint-ignore-file no-explicit-any
import { TypeCheck, TypeCompiler, TypeGuard } from "../../deps.ts";
import type {
	ContextDeriver,
	Handler,
	RequestHandler,
	RouteSegment,
} from "./types.ts";

export default function makeCompiledRouter(
	rst: RouteSegment[],
	context: Record<string, unknown>,
	derivers: Array<ContextDeriver<any>>,
): RequestHandler {
	const { code, handlers, definitions } = getRouterCode(rst);
	return Function("data", code)({ handlers, definitions, context, derivers });
}

export type DefinitionSchemas = {
	params?: TypeCheck<any>;
	headers?: TypeCheck<any>;
	body?: TypeCheck<any>;
	query?: TypeCheck<any>;
	response?: {
		[status: number]: {
			[contentType: string]: TypeCheck<any>;
		};
	};
};

export function getRouterCode(
	rst: RouteSegment[],
): { code: string; handlers: Handler[]; definitions: DefinitionSchemas[] } {
	const handlers: Handler[] = [];
	const definitions: DefinitionSchemas[] = [];

	// deno-fmt-ignore
	const code = `const { handlers, definitions, context, derivers } = data;
	return async function router(request, ...args) {
	  try {
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
	definitions: DefinitionSchemas[],
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
		for (
			const [method, { handler, definition }] of Object.entries(
				segment.operations,
			)
		) {
			const id = handlers.length;
			handlers.push(handler);
			definitions.push({
				headers: definition.headers
					? TypeCompiler.Compile(definition.body)
					: undefined,
				params: definition.params
					? TypeCompiler.Compile(definition.params)
					: undefined,
				query: definition.query
					? TypeCompiler.Compile(definition.query)
					: undefined,
				body: definition.body
					? TypeCompiler.Compile(definition.body)
					: undefined,
				response: definition.response
					? Object.fromEntries(
						Object.entries(definition.response)
							.map(([status, definition]) => [
								status,
								definition.content
									? Object.fromEntries(
										Object.entries(definition.content)
											.map((
												[contentType, definition],
											) => [
												contentType,
												definition.schema
													? TypeCompiler.Compile(definition.schema as any)
													: undefined,
											]),
									)
									: undefined,
							]),
					) as any
					: undefined,
			});
			// deno-fmt-ignore
			code += `${!first ? `else ` : ``}if (method === "${method}") {
			  let body = {};
			  const headers = Object.fromEntries(request.headers);

			  ${definition.headers
				? `if (!definitions[${id}].headers.Check(headers)) { return new Response(null, { status: 400 }); }`
				: ``}
			  ${definition.params
				? `if (!definitions[${id}].params.Check(params)) { return new Response(null, { status: 400 }); }`
				: ``}
			  const query = Object.fromEntries(url.searchParams);
			  ${definition.query
				? `if (!definitions[${id}].query.Check(query)) { return new Response(null, { status: 400 }); }`
				: ``}
			  ${definition.body
			    ? `const contentType = request.headers.get("Content-Type")?.toLowerCase();
				  if (contentType?.startsWith("application/json")) {
				    body = await request.json();
				  }
				  else if (contentType === "application/x-www-form-urlencoded") {
				    body = Object.fromEntries(new URLSearchParams(await request.text()));
				  }
				  else if (contentType === "multipart/form-data") {
				    const form = await request.formData();
				    body = Array.from(form.keys()).reduce((body, key) => {
				      const values = form.getAll(key);
				      body[key] = values.length === 1 ? values[0] : values;
				      return body;
				    }, {});
				  }
				  if (!definitions[${id}].body.Check(body)) { return new Response(null, { status: 400 }); }`
			    : ``}
			  const requestContext = { ...context };
			  for (const derive of derivers) {
			    Object.assign(
			      context,
			      derive instanceof Function
			        ? await derive({ request, ...requestContext })
			        : derive,
			    );
			  }
			  return await handlers[${id}]({ request, params, headers, query, body, ...requestContext });
			}`.replace(/\n\t*/g, ieol)+ieol;
			first = false;
		}
		if (!("OPTIONS" in segment.operations)) {
			const headers = Object.values(segment.operations).map(({ definition }) =>
				definition.headers
			).filter(TypeGuard.IsObject).flatMap((schema) =>
				Object.keys(schema.properties)
			).map((name) => name.toUpperCase()).join(", ");
			// deno-fmt-ignore
			code += `else if (method === "OPTIONS") {
			  const origin = request.headers.get("Origin");
			  return new Response(null, {
			    status: 204,
			    headers: {
			      "Access-Control-Allow-Origin": origin ? new URL(origin).host : "*",
			      "Access-Control-Allow-Methods": "${Object.keys(segment.operations).join(", ")}, OPTIONS",
			      "Access-Control-Allow-Headers": "${headers === "" ? "*" : headers}",
			    },
			  });
			}`.replace(/\n\t*/g, ieol)+ieol;
		}
		if (!first) {
			// deno-fmt-ignore
			code += `else {
			  return new Response(null, {
			    status: 405,
			    headers: { Allow: "${Object.keys(segment.operations).join(", ")}, OPTIONS" },
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
