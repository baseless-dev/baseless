import { Configuration } from "./config.ts";
import { Context } from "./context.ts";
import { createLogger } from "./logger.ts";
import authRouter from "./auth/routes.ts";
import { RouterBuilder } from "./router.ts";
import { IdentityProvider } from "./providers/identity.ts";
import { CounterProvider } from "./providers/counter.ts";
import { EmailProvider } from "./providers/email.ts";

const router = new RouterBuilder<[context: Context]>()
	.route("/auth", authRouter)
	.build();

export class Server {
	#logger = createLogger("server");
	#configuration: Configuration;
	#counterProvider: CounterProvider;
	#identityProvider: IdentityProvider;
	#emailProvider: EmailProvider;

	public constructor(
		options: {
			configuration: Configuration;
			counterProvider: CounterProvider;
			identityProvider: IdentityProvider;
			emailProvider: EmailProvider;
		},
	) {
		this.#configuration = options.configuration;
		this.#counterProvider = options.counterProvider;
		this.#identityProvider = options.identityProvider;
		this.#emailProvider = options.emailProvider;
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

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			config: this.#configuration,
			counter: this.#counterProvider,
			identity: this.#identityProvider,
			email: this.#emailProvider,
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
