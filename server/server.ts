import { Configuration } from "./config.ts";
import { Context } from "./context.ts";
import { createLogger } from "./logger.ts";
import { AssetProvider } from "./providers/asset.ts";
import { CounterProvider } from "./providers/counter.ts";
import { Router, RouterBuilder } from "./router.ts";
import { AssetService } from "./services/asset.ts";
import { CounterService } from "./services/counter.ts";

export class Server {
	#logger = createLogger("server");
	#configuration: Configuration;
	#assetProvider: AssetProvider;
	#counterProvider: CounterProvider;

	#router: Router<[context: Context]>;

	public constructor(
		options: {
			configuration: Configuration;
			assetProvider: AssetProvider;
			counterProvider: CounterProvider;
		},
	) {
		this.#configuration = options.configuration;
		this.#assetProvider = options.assetProvider;
		this.#counterProvider = options.counterProvider;

		const routerBuilder = new RouterBuilder<[context: Context]>();

		if (this.#configuration.asset.enabled) {
			routerBuilder.get(
				"/*",
				(request, _params, context) => context.asset.fetch(request),
			);
		}

		this.#router = routerBuilder.build();
	}

	/**
	 * Handle a HTTP request
	 * @param request The HTTP request
	 * @returns The response and promise to wait in the background
	 */
	public async handleRequest(
		request: Request,
	): Promise<[Response, PromiseLike<unknown>[]]> {
		const ip = request.headers.get("X-Real-Ip") ?? "";
		this.#logger.log(`${request.method} ${ip} ${request.url}`);

		const assetService = new AssetService(this.#assetProvider);
		const counterService = new CounterService(this.#counterProvider);

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			config: this.#configuration,
			asset: assetService,
			counter: counterService,
			waitUntil(promise) {
				waitUntilCollection.push(promise);
			},
		};

		try {
			const processRequest = this.#router.process(request, context);
			return [
				await processRequest,
				waitUntilCollection,
			];
		} catch (err) {
			this.#logger.warn(
				`Could not handle request ${request.url}, got error : ${err}`,
			);
			return [
				new Response(null, {
					status: 500,
				}),
				waitUntilCollection,
			];
		}
	}
}
