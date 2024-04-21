// deno-lint-ignore-file no-explicit-any ban-types
import { FormatRegistry } from "npm:@sinclair/typebox@0.32.13/type";
import { makeCompiled } from "./compiled.ts";
import { makeDynamic } from "./dynamic.ts";
import { parseRST } from "./rst.ts";
import {
	ApplicationExtendsPlugin,
	ApplicationMergePlugin,
	type ContextDecorator,
	type ContextDeriver,
	type Definition,
	type EventListener,
	ExtractParamsAsSchemaRuntime,
	type ExtractPathParams,
	type ExtractPathParamsAsSchema,
	type Handler,
	type Method,
	type Plugin,
	PluginWithPrefix,
	type RequestHandler,
	type Routes,
} from "./types.ts";
import type { MaybePromise } from "../types.ts";
import { EventEmitter, type ReadonlyEventEmitter } from "../event_emitter.ts";

FormatRegistry.Set("path", (value) => typeof value === "string");

export class Application<
	TContext extends {} = {},
	TEvents extends Record<string, any[]> = {},
	TContextDeps extends {} = {},
	TEventDeps extends Record<string, any[]> = {},
> {
	#decorators: Array<ContextDecorator<any>> = [];
	#derivers: Array<ContextDeriver<any, any>> = [];
	#plugins: Array<PluginWithPrefix> = [];
	#routes: Routes = [];
	#events: Array<EventListener> = [];

	constructor();
	constructor(
		decorators: Array<ContextDecorator<any>>,
		derivers: Array<ContextDeriver<any, any>>,
		plugins: Array<PluginWithPrefix>,
		routes: Routes,
		events: Array<EventListener>,
	);
	constructor(
		decorators?: Array<ContextDecorator<any>>,
		derivers?: Array<ContextDeriver<any, any>>,
		plugins?: Array<PluginWithPrefix>,
		routes?: Routes,
		events?: Array<EventListener>,
	) {
		this.#decorators = [...decorators ?? []];
		this.#derivers = [...derivers ?? []];
		this.#plugins = [...plugins ?? []];
		this.#routes = [...routes ?? []];
		this.#events = [...events ?? []];
	}

	demands<const TNewContextDeps extends {}>(): Application<
		TContext & TNewContextDeps,
		TEvents,
		TContextDeps & TNewContextDeps,
		TEventDeps
	>;
	demands<
		const TEvent extends string,
		const TArgs extends any[],
	>(): Application<
		TContext,
		& TEvents
		& {
			[event in TEvent]: TArgs;
		},
		TContextDeps,
		& TEventDeps
		& {
			[event in TEvent]: TArgs;
		}
	>;
	demands(): any {
		return this as any;
	}

	decorate<const TNewContext extends {}>(
		decorator: ContextDecorator<TNewContext>,
	): Application<TContext & TNewContext, TEvents, TContextDeps, TEventDeps> {
		return new Application(
			[...this.#decorators, decorator],
			this.#derivers,
			this.#plugins,
			this.#routes,
			this.#events,
		);
	}

	derive<const TNewContext extends {}>(
		deriver: ContextDeriver<
			TNewContext,
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> }
		>,
	): Application<TContext & TNewContext, TEvents, TContextDeps, TEventDeps> {
		return new Application(
			this.#decorators,
			[...this.#derivers, deriver],
			this.#plugins,
			this.#routes,
			this.#events,
		);
	}

	emits<
		const TEvent extends string,
		const TArgs extends any[],
	>(): Application<
		TContext,
		& TEvents
		& {
			[event in TEvent]: TArgs;
		},
		TContextDeps,
		TEventDeps
	> {
		return new Application(
			this.#decorators,
			this.#derivers,
			this.#plugins,
			this.#routes,
			this.#events,
		);
	}

	use<
		const TPluginContext extends {},
		const TPluginEvents extends Record<string, any[]>,
		const TPluginContextDeps extends {},
		const TPluginEventDeps extends Record<string, any[]>,
		const TPlugin extends Plugin<
			TPluginContext,
			TPluginEvents,
			TPluginContextDeps,
			TPluginEventDeps
		>,
	>(
		plugin: ApplicationExtendsPlugin<
			Application<TContext, TEvents, TContextDeps, TEventDeps>,
			TPlugin
		>,
	): ApplicationMergePlugin<
		Application<TContext, TEvents, TContextDeps, TEventDeps>,
		TPlugin
	>;
	use<
		const TPluginContext extends {},
		const TPluginEvents extends Record<string, any[]>,
		const TPluginContextDeps extends {},
		const TPluginEventDeps extends Record<string, any[]>,
		const TPlugin extends Plugin<
			TPluginContext,
			TPluginEvents,
			TPluginContextDeps,
			TPluginEventDeps
		>,
	>(
		prefix: string,
		plugin: ApplicationExtendsPlugin<
			Application<TContext, TEvents, TContextDeps, TEventDeps>,
			TPlugin
		>,
	): ApplicationMergePlugin<
		Application<TContext, TEvents, TContextDeps, TEventDeps>,
		TPlugin
	>;
	use<
		const TPluginContext extends {},
		const TPluginEvents extends Record<string, any[]>,
		const TPluginContextDeps extends {},
		const TPluginEventDeps extends Record<string, any[]>,
		const TPlugin extends Plugin<
			TPluginContext,
			TPluginEvents,
			TPluginContextDeps,
			TPluginEventDeps
		>,
	>(
		prefix: string | TPlugin,
		plugin?: ApplicationExtendsPlugin<
			Application<TContext, TEvents, TContextDeps, TEventDeps>,
			TPlugin
		>,
	): ApplicationMergePlugin<
		Application<TContext, TEvents, TContextDeps, TEventDeps>,
		TPlugin
	> {
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
			this.#events,
		) as any;
	}

	proxy<
		const TDefinition extends Pick<
			Definition<
				any,
				any,
				any,
				any
			>,
			"params"
		>,
		const THandler extends Handler<
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			{},
			TDefinition
		>,
	>(
		application: Application,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps>;
	proxy<
		const TPath extends string,
		const TDefinition extends Pick<
			Definition<
				ExtractPathParamsAsSchema<TPath>,
				any,
				any,
				any
			>,
			"params"
		>,
		const THandler extends Handler<
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		prefix: TPath,
		application: Application,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps>;
	proxy(
		prefix_or_application: string | Application,
		application_or_handler:
			| Application
			| ((context: any) => Response | Promise<Response>),
		handler_or_definition?:
			| ((context: any) => Response | Promise<Response>)
			| Definition<any, any, any, any>,
		definition?: Definition<any, any, any, any>,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
		const prefix = typeof prefix_or_application === "string"
			? prefix_or_application
			: "";
		const application = typeof prefix_or_application === "string"
			? application_or_handler as Application
			: prefix_or_application;
		const handler = typeof application_or_handler === "function"
			? application_or_handler
			: handler_or_definition as ((
				context: any,
			) => Response | Promise<Response>);
		definition = typeof application_or_handler === "function"
			? definition
			: handler_or_definition as Definition<any, any, any, any>;
		return new Application(
			this.#decorators,
			this.#derivers,
			this.#plugins,
			[
				...this.#routes,
				...application.#routes.map((route) => ({
					...route,
					path: `${prefix}${route.path}`,
					handler,
				})),
			],
			this.#events,
		);
	}

	on<TEvent extends keyof TEvents>(
		event: TEvent,
		handler: (
			context: TContext & TContextDeps,
			...args: TEvents[TEvent]
		) => MaybePromise<void>,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
		return new Application(
			this.#decorators,
			this.#derivers,
			this.#plugins,
			this.#routes,
			[...this.#events, { event, handler } as EventListener],
		);
	}

	#defineRoute(
		path: string,
		method: Method,
		handler: Handler,
		definition: Definition<any, any, any, any>,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			this.#events,
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
			TContext & TContextDeps & { events: ReadonlyEventEmitter<TEvents> },
			ExtractPathParams<TPath>,
			TDefinition
		>,
	>(
		path: TPath,
		handler: THandler,
		definition?: TDefinition,
	): Application<TContext, TEvents, TContextDeps, TEventDeps> {
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
		const events = new EventEmitter();
		for (const { event, handler } of this.#events) {
			events.on(event as never, handler);
		}
		const context = {
			events,
		};
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
