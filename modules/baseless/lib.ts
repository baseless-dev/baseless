import { Configuration } from "./config.ts";
import { Context } from "./context.ts";
import { logger } from "./logger.ts";

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

		let processRequest: Response | Promise<Response> | undefined;

		processRequest = await this.configuration.auth.render?.(context, request);

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
