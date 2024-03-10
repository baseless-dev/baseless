// deno-lint-ignore-file no-explicit-any ban-types
import { FormatRegistry } from "npm:@sinclair/typebox@0.32.13/type";
import type { MaybePromise } from "../types.ts";
import type { MaybeCallable } from "../types.ts";
import { makeCompiled } from "./compiled.ts";
import { makeDynamic } from "./dynamic.ts";
import { parseRST } from "./rst.ts";
import {
	type ContextDecorator,
	type ContextDeriver,
	type Definition,
	ExtractParamsAsSchemaRuntime,
	type ExtractPathParams,
	type ExtractPathParamsAsSchema,
	type Handler,
	type Method,
	type RequestHandler,
	type Route,
	type Routes,
} from "./types.ts";

FormatRegistry.Set("path", (value) => typeof value === "string");

export type Plugin<TContext extends {} = {}, TDependencies extends {} = {}> =
	MaybeCallable<
		MaybePromise<Application<TContext, TDependencies>>,
		[ReadonlyArray<Route>]
	>;

export type PluginWithPrefix<TContext extends {} = {}> = {
	plugin: Plugin<TContext>;
	prefix: string;
};

export type ApplicationExtendsPlugin<R1, R2> = R1 extends
	Application<infer Context, any>
	? R2 extends Application<any, infer Dependencies>
		? Context extends Dependencies ? R2
		: { error: "Application does not implement dependencies." }
	: R2
	: R2;

export type ApplicationMergePlugin<R, P> = R extends
	Application<infer Context, infer Dependencies>
	? P extends Plugin<infer PluginContext, infer PluginDependencies>
		? Application<Context & PluginContext, Dependencies>
	: R
	: R;

export class Application<
	TContext extends {} = {},
	TDependencies extends {} = {},
> {
	#decorators: Array<ContextDecorator<any>> = [];
	#derivers: Array<ContextDeriver<any, any>> = [];
	#plugins: Array<PluginWithPrefix<any>> = [];
	#routes: Routes = [];

	constructor();
	constructor(
		decorators: Array<ContextDecorator<any>>,
		derivers: Array<ContextDeriver<any, any>>,
		plugins: Array<PluginWithPrefix<any>>,
		routes: Routes,
	);
	constructor(
		decorators?: Array<ContextDecorator<any>>,
		derivers?: Array<ContextDeriver<any, any>>,
		plugins?: Array<PluginWithPrefix<any>>,
		routes?: Routes,
	) {
		this.#decorators = [...decorators ?? []];
		this.#derivers = [...derivers ?? []];
		this.#plugins = [...plugins ?? []];
		this.#routes = [...routes ?? []];
	}

	decorate<const TNewContext extends {}>(
		decorator: ContextDecorator<TNewContext>,
	): Application<TContext & TNewContext, TDependencies> {
		return new Application(
			[...this.#decorators, decorator],
			this.#derivers,
			this.#plugins,
			this.#routes,
		);
	}

	derive<const TNewContext extends {}>(
		deriver: ContextDeriver<TNewContext, TContext & TDependencies>,
	): Application<TContext & TNewContext, TDependencies> {
		return new Application(
			this.#decorators,
			[...this.#derivers, deriver],
			this.#plugins,
			this.#routes,
		);
	}

	use<
		const TPluginContext extends {},
		const TPluginDependencies extends {},
		const TPlugin extends Plugin<TPluginContext, TPluginDependencies>,
	>(
		plugin: ApplicationExtendsPlugin<
			Application<TContext, TDependencies>,
			TPlugin
		>,
	): ApplicationMergePlugin<Application<TContext, TDependencies>, TPlugin>;
	use<
		const TPluginContext extends {},
		const TPluginDependencies extends {},
		const TPlugin extends Plugin<TPluginContext, TPluginDependencies>,
	>(
		prefix: string,
		plugin: ApplicationExtendsPlugin<
			Application<TContext, TDependencies>,
			TPlugin
		>,
	): ApplicationMergePlugin<Application<TContext, TDependencies>, TPlugin>;
	use<
		const TPluginContext extends {},
		const TPluginDependencies extends {},
		const TPlugin extends Plugin<TPluginContext, TPluginDependencies>,
	>(
		prefix: string | TPlugin,
		plugin?: ApplicationExtendsPlugin<
			Application<TContext, TDependencies>,
			TPlugin
		>,
	): ApplicationMergePlugin<Application<TContext, TDependencies>, TPlugin> {
		if (typeof prefix !== "string") {
			plugin = prefix as any;
			prefix = "";
		}
		return new Application(
			this.#decorators,
			this.#derivers,
			[...this.#plugins, {
				plugin: plugin as any,
				prefix,
			}],
			this.#routes,
		) as any;
	}

	#defineRoute(
		path: string,
		method: Method,
		handler: Handler,
		definition: Definition<any, any, any, any>,
	): Application<TContext, TDependencies> {
		return new Application(
			this.#decorators,
			this.#derivers,
			this.#plugins,
			[...this.#routes, {
				path,
				method,
				handler,
				definition: {
					...definition,
					params: definition.params ?? ExtractParamsAsSchemaRuntime(path),
				},
			}],
		);
	}

	connect<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "CONNECT", handler, { ...definition });
	}

	delete<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "DELETE", handler, { ...definition });
	}

	get<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "GET", handler, { ...definition });
	}

	head<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "HEAD", handler, { ...definition });
	}

	patch<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "PATCH", handler, { ...definition });
	}

	post<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "POST", handler, { ...definition });
	}

	put<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "PUT", handler, { ...definition });
	}

	options<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "OPTIONS", handler, { ...definition });
	}

	trace<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this.#defineRoute(path, "TRACE", handler, { ...definition });
	}

	any<
		const TPath extends string,
		const TDefinition extends Definition<
			ExtractPathParamsAsSchema<TPath>,
			any,
			any,
			any
		>,
		const THandler extends Handler<
			TContext & TDependencies,
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TDependencies> {
		return this
			.#defineRoute(path, "CONNECT", handler, { ...definition })
			.#defineRoute(path, "DELETE", handler, { ...definition })
			.#defineRoute(path, "GET", handler, { ...definition })
			.#defineRoute(path, "HEAD", handler, { ...definition })
			.#defineRoute(path, "PATCH", handler, { ...definition })
			.#defineRoute(path, "POST", handler, { ...definition })
			.#defineRoute(path, "PUT", handler, { ...definition })
			.#defineRoute(path, "OPTIONS", handler, { ...definition })
			.#defineRoute(path, "TRACE", handler, { ...definition });
	}

	async build(aot = false): Promise<RequestHandler> {
		const decorators = [...this.#decorators];
		const derivers = [...this.#derivers];
		const routes = [...this.#routes];
		for (const plugin of this.#plugins) {
			const result = plugin.plugin instanceof Function
				? await plugin.plugin(routes)
				: plugin.plugin as Application<any, any>;
			decorators.push(...result.#decorators);
			derivers.push(...result.#derivers);
			routes.push(...result.#routes.map((route) => ({
				...route,
				path: `${plugin.prefix}${route.path}`,
			})));
		}
		const context = {};
		for (const decorator of decorators) {
			const result = decorator instanceof Function
				? await decorator()
				: decorator;
			Object.assign(context, result);
		}
		const rst = parseRST(routes);
		return aot
			? makeCompiled(rst, context, derivers)
			: makeDynamic(rst, context, derivers);
	}
}
