export type Method = "GET" | "POST" | "PUT" | "DELETE";

export type AbsolutePath<Path> = Path extends `/${infer A}` ? Path : never;
export type NamedGroups<Segment> = Segment extends `:${infer Name}` ? Name : never;
export type ExtractNamedGroupsFromPath<Path> = Path extends `${infer A}/${infer B}` ? NamedGroups<A> | ExtractNamedGroupsFromPath<B> : NamedGroups<Path>;
export type ExtractNamedGroupsFromAbsolutePath<Path> = Path extends `/${infer A}` ? ExtractNamedGroupsFromPath<A> : never;
export type ExtractParams<Path> = {
    [Key in ExtractNamedGroupsFromAbsolutePath<Path>]: string;
}

export type RouteHandler<Params extends Record<string, string>, Args extends unknown[]> = (req: Request, params: Params, ...args: Args) => Promise<Response> | Response;

export class Router<Args extends unknown[]> {
	#routes = new Map<Method, Map<URLPattern, RouteHandler<Record<string, string>, Args>>>();
	#children = new Map<URLPattern, Router<Args>>();

	/**
	 * Add a new route
	 * @param method The HTTP method
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 */
	add<Path extends string>(method: Method, pathname: Path, handler: RouteHandler<ExtractParams<Path>, Args>) {
		const pattern = new URLPattern({ pathname });
		if (!this.#routes.has(method)) {
			this.#routes.set(method, new Map());
		}
		this.#routes.get(method)?.set(pattern, handler);
	}

	/**
	 * Configure a router at location
	 * @param location Location of the child router
	 * @param router The child router
	 * @returns The router
	 */
	route<Path extends string>(location: AbsolutePath<Path>, router: Router<Args>) {
		const pattern = new URLPattern({ pathname: location+"{/(.*)}?" });
		this.#children.set(pattern, router);
		return this;
	}

	/**
	 * Configure a GET handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	get<Path extends string>(pathname: Path, handler: RouteHandler<ExtractParams<Path>, Args>) {
		this.add("GET", pathname, handler);
		return this;
	}

	/**
	 * Configure a POST handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	post<Path extends string>(pathname: Path, handler: RouteHandler<ExtractParams<Path>, Args>) {
		this.add("POST", pathname, handler);
		return this;
	}

	/**
	 * Configure a PUT handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	put<Path extends string>(pathname: Path, handler: RouteHandler<ExtractParams<Path>, Args>) {
		this.add("PUT", pathname, handler);
		return this;
	}

	/**
	 * Configure a DELETE handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	delete<Path extends string>(pathname: Path, handler: RouteHandler<ExtractParams<Path>, Args>) {
		this.add("DELETE", pathname, handler);
		return this;
	}

	/**
	 * Process a request into a response
	 * @param request The {@see Request}
	 * @returns The {@see Response}
	 */
	process(request: Request, ...args: Args): Promise<Response> {
		const method = request.method.toLocaleUpperCase();
		const routes = this.#routes.get(method as Method);
		if (routes) {
			for (const [pattern, handler] of routes) {
				const result = pattern.exec(request.url);
				if (result) {
					return Promise.resolve(handler(request, result.pathname.groups, ...args));
				}
			}
		}
		for (const [pattern, router] of this.#children) {
			const result = pattern.exec(request.url);
			if (result) {
				const newRequest = new Request(`http://router.local/${result.pathname.groups["0"]}`, request);
				return router.process(newRequest, ...args);
			}
		}
		const url = new URL(request.url);
		throw new RouteNotFound(url.pathname);
	}
}


export class RouteNotFound extends Error {
	public name = "RouteNotFound";
	public constructor(route: string) {
		super(`Route not found for '${route}'.`);
	}
}