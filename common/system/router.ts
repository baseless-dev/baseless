export type Method =
	| "GET"
	| "HEAD"
	| "POST"
	| "PUT"
	| "DELETE"
	| "CONNECT"
	| "OPTIONS"
	| "TRACE"
	| "PATCH";

export type AbsolutePath<Path> = Path extends `/${infer A}` ? Path : never;
export type OptionalNamedGroups<Segment> = Segment extends `:${infer Name}?`
	? Name
	: never;
export type NamedGroups<Segment> = Segment extends `:${infer Name}?` ? never
	: Segment extends `:${infer Name}` ? Name
	: never;
export type ExtractNamedGroupsFromPath<Path> = Path extends
	`${infer A}/${infer B}` ? NamedGroups<A> | ExtractNamedGroupsFromPath<B>
	: NamedGroups<Path>;
export type ExtractNamedGroupsFromAbsolutePath<Path> = Path extends
	`/${infer A}` ? ExtractNamedGroupsFromPath<A> : never;
export type ExtractOptionalNamedGroupsFromPath<Path> = Path extends
	`${infer A}/${infer B}`
	? NamedGroups<A> | ExtractOptionalNamedGroupsFromPath<B>
	: OptionalNamedGroups<Path>;
export type ExtractOptionalNamedGroupsFromAbsolutePath<Path> = Path extends
	`/${infer A}` ? ExtractOptionalNamedGroupsFromPath<A> : never;
export type ExtractParams<Path> =
	& { [Key in ExtractNamedGroupsFromAbsolutePath<Path>]: string }
	& { [Key in ExtractOptionalNamedGroupsFromAbsolutePath<Path>]?: string };

export type RouteHandler<
	Params extends Record<string, string | undefined>,
	Args extends unknown[],
> = (
	req: Request,
	params: Params,
	...args: Args
) => Promise<Response> | Response;

export class RouterBuilder<Args extends unknown[]> {
	#routes = new Map<
		string,
		| Router<Args>
		| RouterBuilder<Args>
		| Set<
			[
				method: Method,
				handler: RouteHandler<Record<string, string | undefined>, Args>,
			]
		>
	>();

	get routes(): ReadonlyMap<
		string,
		| Router<Args>
		| RouterBuilder<Args>
		| Set<
			[
				method: Method,
				handler: RouteHandler<Record<string, string | undefined>, Args>,
			]
		>
	> {
		return this.#routes;
	}

	/**
	 * Build a Router
	 * @returns A router
	 */
	build(): Router<Args> {
		return new Router(new Map(this.#routes));
	}

	/**
	 * Add a new route
	 * @param method The HTTP method
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 */
	add<Path extends string>(
		methods: Method | Method[],
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		let endpoint = this.#routes.get(pathname);
		if (!(endpoint instanceof Set)) {
			endpoint = new Set();
			this.#routes.set(pathname, endpoint);
		}
		if (!Array.isArray(methods)) {
			methods = [methods];
		}
		for (const method of methods) {
			// deno-lint-ignore no-explicit-any
			endpoint.add([method, handler as any]);
		}
		return this;
	}

	/**
	 * Configure a router at location
	 * @param location Location of the child router
	 * @param router The child router
	 * @returns The router
	 */
	route<Path extends string>(
		pathname: AbsolutePath<Path>,
		router: Router<Args> | RouterBuilder<Args>,
	) {
		this.#routes.set(pathname, router);
		return this;
	}

	/**
	 * Configure a handler for all method
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	any<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		for (
			const method of [
				"GET",
				"HEAD",
				"POST",
				"PUT",
				"DELETE",
				"CONNECT",
				"OPTIONS",
				"TRACE",
				"PATCH",
			] as Method[]
		) {
			this.add(method, pathname, handler);
		}
		return this;
	}

	/**
	 * Configure a GET handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	get<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("GET", pathname, handler);
	}

	/**
	 * Configure a HEAD handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	head<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("HEAD", pathname, handler);
	}

	/**
	 * Configure a POST handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	post<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("POST", pathname, handler);
	}

	/**
	 * Configure a PUT handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	put<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("PUT", pathname, handler);
	}

	/**
	 * Configure a DELETE handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	delete<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("DELETE", pathname, handler);
	}

	/**
	 * Configure a CONNECT handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	connect<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("CONNECT", pathname, handler);
	}

	/**
	 * Configure a OPTIONS handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	options<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("OPTIONS", pathname, handler);
	}

	/**
	 * Configure a TRACE handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	trace<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("TRACE", pathname, handler);
	}

	/**
	 * Configure a PATCH handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	patch<Path extends string>(
		pathname: Path,
		handler: RouteHandler<ExtractParams<Path>, Args>,
	) {
		return this.add("PATCH", pathname, handler);
	}
}

type RouterEndpoint<Args extends unknown[]> = Map<
	Method,
	RouteHandler<Record<string, string | undefined>, Args>
>;

export class Router<Args extends unknown[]> {
	#routes = new Map<URLPattern, RouterEndpoint<Args>>();

	constructor(
		routeDefinitions?: Iterable<
			[
				string,
				| Router<Args>
				| RouterBuilder<Args>
				| Set<
					[
						method: Method,
						handler: RouteHandler<Record<string, string | undefined>, Args>,
					]
				>,
			]
		>,
	) {
		if (routeDefinitions) {
			walkRoutes("", this.#routes, routeDefinitions);
		}
		function walkRoutes(
			prefix: string,
			target: Map<URLPattern, RouterEndpoint<Args>>,
			routeDefinitions: Iterable<
				[
					string,
					| Router<Args>
					| RouterBuilder<Args>
					| Set<
						[
							method: Method,
							handler: RouteHandler<Record<string, string | undefined>, Args>,
						]
					>,
				]
			>,
		) {
			for (const [pathname, router_or_endpoints] of routeDefinitions) {
				if (router_or_endpoints instanceof RouterBuilder) {
					walkRoutes(prefix + pathname, target, router_or_endpoints.routes);
				} else if (router_or_endpoints instanceof Router) {
					for (const [oldPattern, oldEndpoint] of router_or_endpoints.#routes) {
						const pattern = new URLPattern({
							...oldPattern,
							pathname: prefix + oldPattern.pathname,
						});
						let endpoint: RouterEndpoint<Args>;
						if (!target.has(pattern)) {
							endpoint = new Map();
							target.set(pattern, endpoint);
						} else {
							endpoint = target.get(pattern)!;
						}
						for (const [method, handler] of oldEndpoint) {
							endpoint.set(method, handler);
						}
					}
				} else {
					const pattern = new URLPattern({ pathname: prefix + pathname });
					for (const route_or_handler of router_or_endpoints) {
						const [method, handler] = route_or_handler;
						let endpoint: RouterEndpoint<Args>;
						if (!target.has(pattern)) {
							endpoint = new Map();
							target.set(pattern, endpoint);
						} else {
							endpoint = target.get(pattern)!;
						}
						endpoint.set(method, handler);
					}
				}
			}
		}
	}

	/**
	 * Process a request into a response
	 * @param request The {@see Request}
	 * @returns The {@see Response}
	 */
	process(request: Request, ...args: Args): Promise<Response> {
		const method = request.method.toLocaleUpperCase();
		for (const [pattern, endpoints] of this.#routes) {
			const result = pattern.exec(request.url);
			if (result) {
				const handler = endpoints.get(method as Method);
				if (handler) {
					return Promise.resolve(
						handler(request, result.pathname.groups, ...args),
					);
				}
				return Promise.resolve(
					new Response(null, {
						status: 405,
						headers: { Allow: Array.from(endpoints.keys()).join(", ") },
					}),
				);
			}
		}
		return Promise.resolve(new Response(null, { status: 404 }));
	}
}
