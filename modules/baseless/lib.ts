import { handleLogin } from "./auth/controller.ts";
import { Configuration } from "./config.ts";
import { Context } from "./context.ts";
import { logger } from "./logger.ts";

const routes = new Map<URLPattern, (context: Context, request: Request, params?: Record<string, string>) => Response | Promise<Response>>([
	[new URLPattern({ pathname: '/login' }), handleLogin]
]);

export class Baseless {
	protected readonly logger = logger("baseless");

	public constructor(public readonly configuration: Configuration) {}

	/**
	 * Handle a HTTP request
	 * @param request The HTTP request
	 * @returns The response and promise to wait in the background
	 */
	public async handleRequest(request: Request): Promise<[Response, PromiseLike<unknown>[]]> {
		this.logger.debug(`${request.method} ${request.url}`);

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			config: this.configuration,
			waitUntil(promise) {
				waitUntilCollection.push(promise);
			},
		}

		let processRequest: Response | Promise<Response> | undefined;

		for (const [route, handler] of routes) {
			const matches = route.exec(request.url);
			if (matches) {
				const params = matches.pathname.groups;
				processRequest = handler(context, request, params);
				break;
			}
		}

		if (!processRequest) {
			return [
				new Response(null, {
					status: 400,
				}),
				waitUntilCollection,
			];
		}

		try {
			return [
				await processRequest,
				waitUntilCollection,
			];
		} catch (err) {
			this.logger.error(`Could not handle request ${request.url}, got error : ${err}`);
			return [
				new Response(null, {
					status: 500,
				}),
				waitUntilCollection,
			];
		}
	}
}
