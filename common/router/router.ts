import type { MaybeCallable, MaybePromise, Pretty } from "../system/types.ts";
import { compileRouter } from "./compiled_router.ts";
import { dynamicRouter } from "./dynamic_router.ts";
import { parseRST } from "./rst.ts";
import {
	Definition,
	ExtractParamsAsSchemaRuntime,
	type ExtractPathParams,
	ExtractPathParamsAsSchema,
	Handler,
	Method,
	Operations,
	RequestHandler,
	type Routes,
} from "./types.ts";

export type ExtractRoutesFromPlugin<TPlugin, TBase extends string> =
	TPlugin extends Plugin<infer TArgs, infer TRoutes>
		? { [Path in keyof TRoutes as `${TBase}${string & Path}`]: TRoutes[Path] }
		: { BOB: true };
export type Plugin<TArgs extends unknown[], TRoutes extends Routes> =
	| Router<TArgs, TRoutes>
	| MaybeCallable<MaybePromise<Router<TArgs, TRoutes>>, [Routes]>;

export class Router<
	TArgs extends unknown[] = [],
	// deno-lint-ignore ban-types
	TRoutes extends Routes = {},
> {
	#routes: TRoutes = {} as TRoutes;
	#plugins: { [path: string]: Plugin<TArgs, Routes> } = {};

	get routes(): TRoutes {
		return this.#routes;
	}

	get plugins(): { [path: string]: Plugin<TArgs, Routes> } {
		return this.#plugins;
	}

	#add(
		method: Method,
		path: string,
		handler: Handler,
		definition?: Definition,
	): void {
		let routes: Routes = this.#routes;
		routes[path] ??= {} as Operations;
		const params = ExtractParamsAsSchemaRuntime(path);
		routes = {
			...routes,
			[path]: {
				...routes[path],
				[method]: {
					handler,
					definition: { ...definition, ...(params ? { params } : {}) },
				},
			},
		};
		this.#routes = routes as TRoutes;
	}

	use<
		const TPlugin extends Plugin<TArgs, any>,
	>(plugin: TPlugin): Router<
		TArgs,
		Pretty<TRoutes & ExtractRoutesFromPlugin<TPlugin, "">>
	>;
	use<
		const TPath extends string,
		const TPlugin extends Plugin<TArgs, any>,
	>(path: TPath, plugin: TPlugin): Router<
		TArgs,
		Pretty<TRoutes & ExtractRoutesFromPlugin<TPlugin, TPath>>
	>;
	// deno-lint-ignore no-explicit-any
	use(path: any, builder?: any): any {
		if (!(typeof path === "string")) {
			builder = path;
			path = "";
		}
		this.#plugins[path] = builder;
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	connect<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	connect<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	connect(path: any, handler: any, definition?: any): any {
		this.#add("CONNECT", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	delete<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					DELETE: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	delete<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					DELETE: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	delete(path: any, handler: any, definition?: any): any {
		this.#add("DELETE", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	get<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					GET: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	get<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					GET: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	get(path: any, handler: any, definition?: any): any {
		this.#add("GET", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	head<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					HEAD: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	head<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					HEAD: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	head(path: any, handler: any, definition?: any): any {
		this.#add("HEAD", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	patch<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PATCH: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	patch<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PATCH: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	patch(path: any, handler: any, definition?: any): any {
		this.#add("PATCH", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	post<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					POST: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	post<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					POST: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	post(path: any, handler: any, definition?: any): any {
		this.#add("POST", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	put<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PUT: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	put<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					PUT: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	put(path: any, handler: any, definition?: any): any {
		this.#add("PUT", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	options<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					OPTIONS: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	options<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					OPTIONS: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	options(path: any, handler: any, definition?: any): any {
		this.#add("OPTIONS", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	trace<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					TRACE: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	trace<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					TRACE: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	trace(path: any, handler: any, definition?: any): any {
		this.#add("TRACE", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	any<
		const TPath extends string,
		const THandler extends Handler<TArgs, ExtractPathParams<TPath>>,
	>(
		path: TPath,
		handler: THandler,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					DELETE: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					GET: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					HEAD: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					PATCH: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					POST: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					PUT: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					OPTIONS: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
					TRACE: {
						handler: THandler;
						definition: { params: ExtractPathParamsAsSchema<TPath> };
					};
				};
			}
		>
	>;
	any<
		const TPath extends string,
		const TDefinition extends Omit<Definition, "params">,
		const THandler extends Handler<
			TArgs,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition: TDefinition,
	): Router<
		TArgs,
		Pretty<
			& TRoutes
			& {
				[path in TPath]: {
					CONNECT: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					DELETE: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					HEAD: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					GET: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					PATCH: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					POST: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					PUT: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					OPTIONS: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
					TRACE: {
						handler: THandler;
						definition: TDefinition & {
							params: ExtractPathParamsAsSchema<TPath>;
						};
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	any(path: any, handler: any, definition?: any): any {
		this.#add("CONNECT", path, handler, definition);
		this.#add("DELETE", path, handler, definition);
		this.#add("GET", path, handler, definition);
		this.#add("HEAD", path, handler, definition);
		this.#add("PATCH", path, handler, definition);
		this.#add("POST", path, handler, definition);
		this.#add("PUT", path, handler, definition);
		this.#add("OPTIONS", path, handler, definition);
		this.#add("TRACE", path, handler, definition);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	async build(tryCompile = true): Promise<RequestHandler<TArgs>> {
		let routes: Routes = { ...this.#routes };
		for (let [path, plugin] of Object.entries(this.#plugins)) {
			if (plugin instanceof Function) {
				plugin = plugin(routes);
			}
			if (plugin instanceof Promise) {
				plugin = await plugin;
			}
			for (const [subPath, operations] of Object.entries(plugin.routes)) {
				routes = {
					...routes,
					[`${path}${subPath}`]: {
						...routes[`${path}${subPath}`],
						...operations,
					},
				};
			}
		}
		const rst = parseRST(routes);
		if (tryCompile && "eval" in globalThis) {
			return compileRouter<TArgs>(rst);
		}
		return dynamicRouter<TArgs>(this.#routes);
	}
}
