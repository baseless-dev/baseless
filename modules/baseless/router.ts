export type Method = "GET" | "POST" | "PUT" | "DELETE";

export type RouteHandler<T = {}> = (options: T & { request: Request; params: Record<string, string>; }) => Promise<Response> | Response;

export class Router<T = {}> {
	#routes = new Map<Method, Map<URLPattern, RouteHandler<T>>>();
	#children = new Map<URLPattern, Router<T>>();

	/**
	 * Add a new route
	 * @param method The HTTP method
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 */
	add(method: Method, pathname: string, handler: RouteHandler<T>) {
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
	route(location: string, router: Router<T>) {
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
	get(pathname: string, handler: RouteHandler<T>) {
		this.add("GET", pathname, handler);
		return this;
	}

	/**
	 * Configure a POST handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	post(pathname: string, handler: RouteHandler<T>) {
		this.add("POST", pathname, handler);
		return this;
	}

	/**
	 * Configure a PUT handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	put(pathname: string, handler: RouteHandler<T>) {
		this.add("PUT", pathname, handler);
		return this;
	}

	/**
	 * Configure a DELETE handler
	 * @param pathname Pathname of the {@see URLPattern.pathname}
	 * @param handler Route handler
	 * @returns The router
	 */
	delete(pathname: string, handler: RouteHandler<T>) {
		this.add("DELETE", pathname, handler);
		return this;
	}

	/**
	 * Process a request into a response
	 * @param request The {@see Request}
	 * @returns The {@see Response}
	 */
	process(request: Request, args: T): Promise<Response> {
		const method = request.method.toLocaleUpperCase();
		const routes = this.#routes.get(method as Method);
		if (routes) {
			for (const [pattern, handler] of routes) {
				const result = pattern.exec(request.url);
				if (result) {
					return Promise.resolve(handler({ request, params: result.pathname.groups, ...args }));
				}
			}
		}
		for (const [pattern, router] of this.#children) {
			const result = pattern.exec(request.url);
			if (result) {
				const newRequest = new Request(`http://router.local/${result.pathname.groups["0"]}`, request);
				return router.process(newRequest, args);
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