import apiAuthRouter from "./api/auth.ts";
import authRouter from "./auth/routes.ts";
import { Configuration } from "./config.ts";
import { Context } from "./context.ts";
import { createLogger } from "./logger.ts";
import { AssetProvider } from "./providers/asset.ts";
import { CounterProvider } from "./providers/counter.ts";
import { IdentityProvider } from "./providers/identity.ts";
import { KVProvider } from "./providers/kv.ts";
import { SessionProvider } from "./providers/session.ts";
import { Router, RouterBuilder } from "./router.ts";
import { AssetService } from "./services/asset.ts";
import { AuthenticationService } from "./services/auth.ts";
import { CounterService } from "./services/counter.ts";
import { IdentityService } from "./services/identity.ts";
import { KVService } from "./services/kv.ts";
import { SessionService } from "./services/session.ts";

export class Server {
	#logger = createLogger("server");
	#configuration: Configuration;
	#assetProvider: AssetProvider;
	#counterProvider: CounterProvider;
	#kvProvider: KVProvider;
	#identityProvider: IdentityProvider;
	#sessionProvider: SessionProvider;

	#router: Router<[context: Context]>;

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

		const routerBuilder = new RouterBuilder<[context: Context]>();

		if (this.#configuration.auth.enabled) {
			routerBuilder.route("/auth", authRouter);
			routerBuilder.route("/api/auth", apiAuthRouter);
		}

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

		const assetService = new AssetService(this.#assetProvider);
		const counterService = new CounterService(this.#counterProvider);
		const kvService = new KVService(this.#kvProvider);
		const identityService = new IdentityService(
			this.#configuration,
			this.#identityProvider,
			this.#counterProvider,
		);
		const sessionService = new SessionService(
			this.#configuration,
			this.#sessionProvider,
		);
		const authenticationService = new AuthenticationService(
			this.#configuration,
			this.#identityProvider,
			this.#counterProvider,
			this.#kvProvider,
		);

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			remoteAddress,
			config: this.#configuration,
			asset: assetService,
			counter: counterService,
			kv: kvService,
			identity: identityService,
			session: sessionService,
			auth: authenticationService,
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
