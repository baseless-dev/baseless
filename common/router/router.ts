// deno-lint-ignore-file ban-types
import type { Pretty } from "../system/types.ts";
import { compileRouter } from "./compiled_router.ts";
import { dynamicRouter } from "./dynamic_router.ts";
import { parseRST } from "./rst.ts";
import {
	type ExtractParams,
	type ExtractParamsAsSchema,
	ExtractParamsAsSchemaRuntime,
	type Handler,
	Method,
	type OperationDefinition,
	Operations,
	type RequestHandler,
	type Routes,
} from "./types.ts";

export class Router<
	TArgs extends unknown[] = [],
	TRoutes extends Routes = {},
	TPlugins extends Array<
		Router<TArgs, {}> | ((routes: Routes) => Router<TArgs, {}>)
	> = [],
> {
	// deno-lint-ignore no-explicit-any
	#plugins: TPlugins = [] as any as TPlugins;
	#routes: TRoutes = {} as TRoutes;

	// deno-lint-ignore no-explicit-any
	#add(method: any, path: any, handler: any, schemas?: any): void {
		const routes: Routes = this.#routes;
		routes[path] ??= {} as Operations;
		const params = ExtractParamsAsSchemaRuntime(path);
		routes[path][method as Method] = {
			handler,
			definition: { ...schemas, ...(params ? { params } : {}) },
		};
		this.#routes = routes as TRoutes;
	}

	use<const TPlugin extends Router<TArgs, {}>>(
		builder: TPlugin,
	): Router<
		TArgs,
		TRoutes,
		Pretty<
			& TPlugins
			& TPlugin
		>
	>;
	use<
		const TPlugin extends Router<TArgs, {}>,
		const TFactory extends (routes: Routes) => TPlugin,
	>(
		factory: TFactory,
	): Router<
		TArgs,
		TRoutes,
		Pretty<
			& TPlugins
			& TPlugin
		>
	>;
	// deno-lint-ignore no-explicit-any
	use(builder: any): any {
		this.#plugins.push(builder);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	connect<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	connect<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	connect(path: any, handler: any, schemas?: any): any {
		this.#add("CONNECT", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	delete<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					DELETE: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	delete<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					DELETE: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	delete(path: any, handler: any, schemas?: any): any {
		this.#add("DELETE", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	get<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					GET: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	get<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					GET: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	get(path: any, handler: any, schemas?: any): any {
		this.#add("GET", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	head<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					HEAD: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	head<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					HEAD: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	head(path: any, handler: any, schemas?: any): any {
		this.#add("HEAD", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	patch<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PATCH: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	patch<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PATCH: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	patch(path: any, handler: any, schemas?: any): any {
		this.#add("PATCH", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	post<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					POST: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	post<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					POST: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	post(path: any, handler: any, schemas?: any): any {
		this.#add("POST", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	put<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PUT: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	put<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PUT: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	put(path: any, handler: any, schemas?: any): any {
		this.#add("PUT", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	options<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					OPTIONS: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	options<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					OPTIONS: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	options(path: any, handler: any, schemas?: any): any {
		this.#add("OPTIONS", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	trace<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractParams<TPath>>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					TRACE: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	trace<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					TRACE: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	trace(path: any, handler: any, schemas?: any): any {
		this.#add("TRACE", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	all<
		const TPath extends string,
		const THandler extends Handler<
			TArgs,
			ExtractParams<TPath>
		>,
	>(path: TPath, handler: THandler): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						params: ExtractParamsAsSchema<TPath>;
					};
					DELETE: {
						params: ExtractParamsAsSchema<TPath>;
					};
					GET: {
						params: ExtractParamsAsSchema<TPath>;
					};
					HEAD: {
						params: ExtractParamsAsSchema<TPath>;
					};
					PATCH: {
						params: ExtractParamsAsSchema<TPath>;
					};
					POST: {
						params: ExtractParamsAsSchema<TPath>;
					};
					PUT: {
						params: ExtractParamsAsSchema<TPath>;
					};
					OPTIONS: {
						params: ExtractParamsAsSchema<TPath>;
					};
					TRACE: {
						params: ExtractParamsAsSchema<TPath>;
					};
				};
			}
		>,
		TPlugins
	>;
	all<
		const TPath extends string,
		const TOpDef extends Omit<OperationDefinition, "params">,
		const THandler extends Handler<TArgs, ExtractParams<TPath>, TOpDef>,
	>(path: TPath, handler: THandler, schemas: TOpDef): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					DELETE: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					GET: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					HEAD: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					POST: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					PATCH: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					PUT: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					OPTIONS: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
					TRACE: {
						body: TOpDef["body"];
						query: TOpDef["query"];
						params: ExtractParamsAsSchema<TPath>;
						response: TOpDef["response"];
					};
				};
			}
		>,
		TPlugins
	>;
	// deno-lint-ignore no-explicit-any
	all(path: any, handler: any, schemas?: any): any {
		this.#add("CONNECT", path, handler, schemas);
		this.#add("DELETE", path, handler, schemas);
		this.#add("GET", path, handler, schemas);
		this.#add("HEAD", path, handler, schemas);
		this.#add("PATCH", path, handler, schemas);
		this.#add("POST", path, handler, schemas);
		this.#add("PUT", path, handler, schemas);
		this.#add("OPTIONS", path, handler, schemas);
		this.#add("TRACE", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	finalize(): Routes {
		// Pretty<
		// 	& TRoutes
		// 	& {
		// 		[index in keyof TPlugins]: TPlugins[index] extends
		// 			Router<TArgs, TRoutes, TPlugins> ? TRoutes
		// 			: TPlugins[index] extends
		// 				((router: Router<TArgs, {}>) => Router<TArgs, {}>)
		// 				? ReturnType<TPlugins[index]>
		// 			: never;
		// 	}
		// > {
		const routes: Routes = { ...this.#routes };
		for (const plugin of this.#plugins) {
			const router = plugin instanceof Router ? plugin : plugin(routes);
			for (
				const [path, methods] of Object.entries(router.finalize())
			) {
				for (
					const [method, { handler, definition }] of Object.entries(methods)
				) {
					routes[path] ??= {} as Operations;
					const params = ExtractParamsAsSchemaRuntime(path);
					routes[path][method as Method] = {
						handler,
						definition: { ...definition, ...(params ? { params } : {}) },
					};
				}
			}
		}
		return routes as any;
	}

	build(tryCompile = true): RequestHandler<TArgs> {
		const routes = this.finalize();
		const rst = parseRST(routes);
		if (tryCompile && "eval" in globalThis) {
			return compileRouter<TArgs>(rst);
		}
		return dynamicRouter<TArgs>(this.#routes);
	}
}
