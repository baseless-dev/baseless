import type { Configuration } from "../common/server/config/config.ts";
import type { IContext } from "../common/server/context.ts";
import {
	SESSION_AUTOID_PREFIX,
	type SessionData,
} from "../common/session/data.ts";
import { isAutoId } from "../common/system/autoid.ts";
import { createLogger } from "../common/system/logger.ts";
import { type Router, RouterBuilder } from "../common/system/router.ts";
import type { AssetProvider } from "../providers/asset.ts";
import type { CounterProvider } from "../providers/counter.ts";
import type { IdentityProvider } from "../providers/identity.ts";
import type { KVProvider } from "../providers/kv.ts";
import type { SessionProvider } from "../providers/session.ts";
import apiAuthRouter from "./api/auth.ts";
import { Context } from "./context.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";

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
		let sessionData: SessionData | undefined = undefined;
		if (request.headers.has("Authorization")) {
			const authorization = request.headers.get("Authorization") ?? "";
			const [, scheme, parameters] =
				authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/) ?? [];
			if (scheme === "Bearer") {
				try {
					const { payload } = await jwtVerify(
						parameters,
						configuration.auth.security.keys.publicKey,
					);
					if (isAutoId(payload.sub, SESSION_AUTOID_PREFIX)) {
						const session = await sessionProvider.get(payload.sub).catch((_) =>
							undefined
						);
						if (session) {
							sessionData = session;
						}
					} else {
						this.#logger.warn(
							`Expected authorization JWT.sub to be an identity ID, got ${payload.sub}.`,
						);
					}
				} catch (error) {
					this.#logger.warn(
						`Could not parse authorization header, got error : ${error}`,
					);
				}
			} else {
				this.#logger.warn(`Unknown authorization scheme ${scheme}.`);
			}
			if (!sessionData) {
				return [new Response(null, { status: 403 }), []];
			}
		}

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context = new Context(
			waitUntilCollection,
			remoteAddress,
			sessionData,
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
