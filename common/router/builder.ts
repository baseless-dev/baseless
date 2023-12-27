import {
	type ExtractParams,
	type ExtractParamsAsSchema,
	ExtractParamsAsSchemaRuntime,
	type Handler,
	type InputSchema,
	type Pretty,
	type RouteBase,
} from "./types.ts";

export class Builder<
	Args extends unknown[] = [],
	// deno-lint-ignore ban-types
	Routes extends RouteBase = {},
> {
	#routes: Routes = {} as Routes;
	get routes(): Routes {
		return this.#routes;
	}

	// deno-lint-ignore no-explicit-any
	#add(method: any, path: any, handler: any, schemas?: any): void {
		const routes: RouteBase = this.#routes;
		routes[path] ??= {};
		const params = ExtractParamsAsSchemaRuntime(path);
		routes[path][method] = {
			handler,
			schemas: { ...schemas, ...(params ? { params } : {}) },
		};
		this.#routes = routes as Routes;
	}

	// deno-lint-ignore ban-types
	use<const TBuilder extends Builder<Args, {}>>(
		builder: TBuilder,
	): Builder<
		Args,
		Pretty<
			& Routes
			& TBuilder["routes"]
		>
	> {
		for (const [path, methods] of Object.entries(builder.routes as RouteBase)) {
			for (const [method, { handler, schemas }] of Object.entries(methods)) {
				this.#add(method, path, handler, schemas);
			}
		}
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	connect<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					CONNECT: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	connect<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					CONNECT: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	connect(path: any, handler: any, schemas?: any): any {
		this.#add("CONNECT", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	delete<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					DELETE: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	delete<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					DELETE: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	delete(path: any, handler: any, schemas?: any): any {
		this.#add("DELETE", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	get<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					GET: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	get<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					GET: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	get(path: any, handler: any, schemas?: any): any {
		this.#add("GET", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	head<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					HEAD: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	head<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					HEAD: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	head(path: any, handler: any, schemas?: any): any {
		this.#add("HEAD", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	patch<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					PATCH: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	patch<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					PATCH: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	patch(path: any, handler: any, schemas?: any): any {
		this.#add("PATCH", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	post<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					POST: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	post<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					POST: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	post(path: any, handler: any, schemas?: any): any {
		this.#add("POST", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	put<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					PUT: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	put<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					PUT: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	put(path: any, handler: any, schemas?: any): any {
		this.#add("PUT", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	options<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					OPTIONS: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	options<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					OPTIONS: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	options(path: any, handler: any, schemas?: any): any {
		this.#add("OPTIONS", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	trace<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					TRACE: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	trace<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					TRACE: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
	>;
	// deno-lint-ignore no-explicit-any
	trace(path: any, handler: any, schemas?: any): any {
		this.#add("TRACE", path, handler, schemas);
		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	all<
		const Path extends string,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>
		>,
	>(path: Path, handler: RouteHandler): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					CONNECT: {
						params: ExtractParamsAsSchema<Path>;
					};
					DELETE: {
						params: ExtractParamsAsSchema<Path>;
					};
					GET: {
						params: ExtractParamsAsSchema<Path>;
					};
					HEAD: {
						params: ExtractParamsAsSchema<Path>;
					};
					PATCH: {
						params: ExtractParamsAsSchema<Path>;
					};
					POST: {
						params: ExtractParamsAsSchema<Path>;
					};
					PUT: {
						params: ExtractParamsAsSchema<Path>;
					};
					OPTIONS: {
						params: ExtractParamsAsSchema<Path>;
					};
					TRACE: {
						params: ExtractParamsAsSchema<Path>;
					};
				};
			}
		>
	>;
	all<
		const Path extends string,
		const RouteSchema extends InputSchema,
		const RouteHandler extends Handler<
			Args,
			ExtractParams<Path>,
			RouteSchema
		>,
	>(path: Path, handler: RouteHandler, schemas: RouteSchema): Builder<
		Args,
		Pretty<
			& Routes
			& {
				[path in Path]: {
					CONNECT: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					DELETE: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					GET: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					HEAD: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					POST: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					PATCH: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					PUT: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					OPTIONS: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
					TRACE: {
						body: RouteSchema["body"];
						query: RouteSchema["query"];
						params: ExtractParamsAsSchema<Path>;
						response: RouteSchema["response"];
					};
				};
			}
		>
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
}
