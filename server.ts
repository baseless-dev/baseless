import { Configuration } from "./config.ts";
import { Context } from "./context.ts";
import { createLogger } from "./logger.ts";
import authRouter from "./auth/controller.ts";
import { RouterBuilder } from "./router.ts";

const router = new RouterBuilder<[context: Context]>()
	.route("/auth", authRouter)
	.build();

export class Server {
	protected readonly logger = createLogger("server");

	public constructor(public readonly configuration: Configuration) {}

	/**
	 * Handle a HTTP request
	 * @param request The HTTP request
	 * @returns The response and promise to wait in the background
	 */
	public async handleRequest(request: Request): Promise<[Response, PromiseLike<unknown>[]]> {
		const ip = request.headers.get("X-Forwarded-For") ?? "";
		this.logger.log(`${request.method} ${ip} ${request.url}`);

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			config: this.configuration,
			waitUntil(promise) {
				waitUntilCollection.push(promise);
			},
		};

		try {
			const processRequest = router.process(request, context);
			return [
				await processRequest,
				waitUntilCollection,
			];
		} catch (err) {
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
