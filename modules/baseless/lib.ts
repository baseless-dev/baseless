import { Configuration } from "./config.ts";
import { Context } from "./context.ts";
import { logger } from "./logger.ts";
import authRouter from "./auth/controller.ts";
import { RouteNotFound } from "./router.ts";

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
		};

		
		try {
			const processRequest = authRouter.process(request, { context });
			return [
				await processRequest,
				waitUntilCollection,
			];
		} catch (err) {
			if (err instanceof RouteNotFound) {
				return [
					new Response(null, {
						status: 404,
					}),
					waitUntilCollection,
				];
			} else {
				this.logger.warn(`Could not handle request ${request.url}, got error : ${err}`);
				return [
					new Response(null, {
						status: 500,
					}),
					waitUntilCollection,
				];
			}
		}
	}
}
