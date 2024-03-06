// import type { AuthenticationCeremonyComponent } from "./lib/authentication/types.ts";
// import { Router } from "./lib/router/router.ts";
// import type {
// 	AuthenticationKeys,
// 	RateLimitOptions,
// } from "./plugins/authentication/mod.ts";
// import type { AssetProvider } from "./providers/asset.ts";
// import type { AuthenticationProvider } from "./providers/auth.ts";
// import type { CounterProvider } from "./providers/counter.ts";
// import type { IdentityProvider } from "./providers/identity.ts";
// import type { KVProvider } from "./providers/kv.ts";
// import type { SessionProvider } from "./providers/session.ts";
// import type { Context as AssetContext } from "./plugins/asset/context.ts";
// import { asset as pluginAsset } from "./plugins/asset/mod.ts";
// import type { Context as AuthenticationContext } from "./plugins/authentication/context.ts";
// import { authentication as pluginAuthentication } from "./plugins/authentication/mod.ts";
// import type { Context as RegistrationContext } from "./plugins/registration/context.ts";
// import { registration as pluginRegistration } from "./plugins/registration/mod.ts";

// export type BaseOptions = {
// 	counterProvider: CounterProvider;
// 	kvProvider: KVProvider;
// };

// export type AssetOptions = {
// 	assetProvider: AssetProvider;
// };

// export type AuthenticationOptions = {
// 	identityProvider: IdentityProvider;
// 	sessionProvider: SessionProvider;
// 	keys: AuthenticationKeys;
// 	salt: string;
// 	providers: AuthenticationProvider[];
// 	ceremony: AuthenticationCeremonyComponent;
// 	rateLimit?: RateLimitOptions;
// 	accessTokenTTL?: number;
// 	refreshTokenTTL?: number;
// 	highRiskActionTimeWindow?: number;
// 	allowAnonymousIdentity?: boolean;
// 	allowRegistration?: boolean;
// };

// export type BaselessOptions =
// 	& BaseOptions
// 	& Partial<AssetOptions>
// 	& { auth?: AuthenticationOptions };

// export class Baseless<TContext extends {}> {
// 	#options: BaselessOptions;
// 	#router: Router<TContext>;

// 	constructor(options: BaseOptions);
// 	constructor(
// 		options: BaselessOptions,
// 		router?: Router<TContext>,
// 	);
// 	constructor(
// 		options: BaselessOptions,
// 		router?: Router<TContext>,
// 	) {
// 		this.#options = options;
// 		this.#router = router;
// 	}

// 	get router(): Router<TContext> {
// 		return new Proxy(this.#router, {
// 			get: (target: any, prop: any, receiver: any): any => {
// 				return (...args: any[]) => {
// 					const newTarget = target[prop] instanceof Function
// 						? target[prop](...args)
// 						: target[prop];
// 					if (newTarget !== target) {
// 					}
// 				};
// 			},
// 		});
// 	}
// }

// export function baseless<TOptions extends BaselessOptions>(
// 	options: TOptions,
// ): Baseless<
// 	| (TOptions["assetProvider"] extends AssetProvider ? AssetContext : never)
// 	| (TOptions["auth"] extends AuthenticationOptions ? AuthenticationContext
// 		: never)
// 	| (TOptions["auth"] extends AuthenticationOptions
// 		? (TOptions["auth"]["allowRegistration"] extends true ? RegistrationContext
// 			: never)
// 		: never)
// > {
// 	let router = new Router();
// 	if (options.assetProvider) {
// 		router = router.use(pluginAsset({
// 			asset: options.assetProvider,
// 		}));
// 	}
// 	if (options.auth) {
// 		router = router.use(pluginAuthentication({
// 			counter: options.counterProvider,
// 			kv: options.kvProvider,
// 			identity: options.auth.identityProvider,
// 			session: options.auth.sessionProvider,
// 			keys: options.auth.keys,
// 			salt: options.auth.salt,
// 			providers: options.auth.providers,
// 			ceremony: options.auth.ceremony,
// 			rateLimit: options.auth.rateLimit,
// 			accessTokenTTL: options.auth.accessTokenTTL,
// 			refreshTokenTTL: options.auth.refreshTokenTTL,
// 			highRiskActionTimeWindow: options.auth.highRiskActionTimeWindow,
// 			allowAnonymousIdentity: options.auth.allowAnonymousIdentity,
// 		}));
// 		if (options.auth.allowRegistration === true) {
// 			router = router.use(pluginRegistration({
// 				counter: options.counterProvider,
// 				identity: options.auth.identityProvider,
// 				session: options.auth.sessionProvider,
// 				keys: options.auth.keys,
// 				providers: options.auth.providers,
// 				ceremony: options.auth.ceremony,
// 				rateLimit: options.auth.rateLimit,
// 				accessTokenTTL: options.auth.accessTokenTTL,
// 				refreshTokenTTL: options.auth.refreshTokenTTL,
// 			}));
// 		}
// 	}
// 	return new Baseless(options, router);
// }

// const t1 = baseless({
// 	counterProvider: {} as CounterProvider,
// 	kvProvider: {} as KVProvider,
// 	assetProvider: {} as AssetProvider,
// 	// auth: {
// 	// 	identityProvider: {} as IdentityProvider,
// 	// 	sessionProvider: {} as SessionProvider,
// 	// 	keys: {} as AuthenticationKeys,
// 	// 	salt: "",
// 	// 	providers: [],
// 	// 	ceremony: {} as AuthenticationCeremonyComponent,
// 	// 	allowRegistration: false
// 	// },
// });

/*

const app = new Router()
	.use(kv(options => options
		.configureProvider(kvProvider)
	))
	.use(counter(options => options
		.configureProvider(counterProvider)
	))
	.use(authentication(options => options
		.configureIdentityProvider(identityProvider)
		.configureSessionProvider(sessionProvider)
		.configureKeys({ keys })
	))
	.get("/hello", (context) => {
		context.response.body = "Hello, World!";
	})

*/
