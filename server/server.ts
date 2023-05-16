import { Configuration } from "../common/server/config/config.ts";
import { IContext } from "../common/server/context.ts";
import { createLogger } from "../common/system/logger.ts";
import { Router, RouterBuilder } from "../common/system/router.ts";
import { AssetProvider } from "../providers/asset.ts";
import { CounterProvider } from "../providers/counter.ts";
import { IdentityProvider } from "../providers/identity.ts";
import { KVProvider } from "../providers/kv.ts";
import { SessionProvider } from "../providers/session.ts";
import apiAuthRouter from "./api/auth.ts";
import { Context } from "./context.ts";

export class Server {
	#logger = createLogger("server");
	#configuration: Configuration;
	#assetProvider: AssetProvider;
	#counterProvider: CounterProvider;
	#kvProvider: KVProvider;
	#identityProvider: IdentityProvider;
	#sessionProvider: SessionProvider;

	#router: Router<[context: IContext]>;

	public constructor(
		options: {
			configuration: Configuration;
			assetProvider: AssetProvider;
			counterProvider: CounterProvider;
			kvProvider: KVProvider;
			identityProvider: IdentityProvider;
			sessionProvider: SessionProvider;
		},
	) {
		this.#configuration = options.configuration;
		this.#assetProvider = options.assetProvider;
		this.#counterProvider = options.counterProvider;
		this.#kvProvider = options.kvProvider;
		this.#identityProvider = options.identityProvider;
		this.#sessionProvider = options.sessionProvider;

		const routerBuilder = new RouterBuilder<[context: IContext]>();

		if (this.#configuration.auth.enabled) {
			routerBuilder.route("/api/auth", apiAuthRouter);
		}

		routerBuilder.route("/", this.#configuration.functions);

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
	 * @param remoteAddress The remote address of the connection
	 * @returns The response and promise to wait in the background
	 */
	public async handleRequest(
		request: Request,
		remoteAddress: string,
	): Promise<[Response, PromiseLike<unknown>[]]> {
		this.#logger.log(`${request.method} ${remoteAddress} ${request.url}`);

		const assetProvider = this.#assetProvider;
		const configuration = this.#configuration;
		const counterProvider = this.#counterProvider;
		const kvProvider = this.#kvProvider;
		const identityProvider = this.#identityProvider;
		const sessionProvider = this.#sessionProvider;

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context = new Context(
			waitUntilCollection,
			remoteAddress,
			configuration,
			assetProvider,
			counterProvider,
			kvProvider,
			identityProvider,
			sessionProvider,
		);

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
