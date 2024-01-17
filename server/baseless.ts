import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./api/auth/decrypt_encrypted_authentication_ceremony_state.ts";
import type { AuthenticationCeremonyComponent } from "../common/auth/ceremony/ceremony.ts";
import { Router } from "../common/router/router.ts";
import { AuthenticationService } from "./services/auth.ts";
import { SESSION_AUTOID_PREFIX } from "../common/session/data.ts";
import type { IContext } from "../common/server/context.ts";
import type { AssetProvider } from "../providers/asset.ts";
import type { CounterProvider } from "../providers/counter.ts";
import type { DocumentProvider } from "../providers/document.ts";
import type { IdentityProvider } from "../providers/identity.ts";
import type { KVProvider } from "../providers/kv.ts";
import type { SessionProvider } from "../providers/session.ts";
import type { TokenData } from "../common/server/token_data.ts";
import { createLogger } from "../common/system/logger.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import { isAutoId } from "../common/system/autoid.ts";
import { AssetService } from "./services/asset.ts";
import { CounterService } from "./services/counter.ts";
import { DocumentService } from "./services/document.ts";
import { IdentityService } from "./services/identity.ts";
import { KVService } from "./services/kv.ts";
import { SessionService } from "./services/session.ts";
import type { AuthenticationComponent } from "../common/auth/component.ts";
import { t } from "../common/schema/types.ts";
export * as t from "../common/schema/types.ts";

export type AuthenticationKeys = {
	algo: string;
	privateKey: KeyLike;
	publicKey: KeyLike;
};

export type RateLimitOptions = {
	count: number;
	interval: number;
};

export type AuthenticationOptions = {
	keys: AuthenticationKeys;
	salt: string;
	ceremony: AuthenticationCeremonyComponent;
	components: AuthenticationComponent[];
	rateLimit?: RateLimitOptions;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	allowAnonymousIdentity?: boolean;
	highRiskActionTimeWindow?: number;
};

// TODO: asset provider should not be required if auth is not enabled
// TODO: identity and session provider should not be required if asset is not enabled
export type BaselessOptions = {
	providers: {
		asset: AssetProvider;
		counter: CounterProvider;
		kv: KVProvider;
		document: DocumentProvider;
		identity: IdentityProvider;
		session: SessionProvider;
	};
	auth?: AuthenticationOptions;
};

// deno-lint-ignore explicit-function-return-type
export default function baseless(
	options: BaselessOptions,
) {
	const { providers } = options;
	const configuration: IContext["config"] = {
		auth: options.auth
			? {
				rateLimit: { count: 10, interval: 60 },
				accessTokenTTL: 1000 * 60 * 10,
				refreshTokenTTL: 1000 * 60 * 60 * 24 * 7,
				allowAnonymousIdentity: false,
				highRiskActionTimeWindow: 60 * 5,
				...options.auth,
			}
			: undefined,
	};
	const logger = createLogger("baseless");

	let app = new Router<[waitUntil: Array<PromiseLike<void>>]>()
		.decorate(async ({ request }, waitUntil) => {
			let authenticationToken: TokenData | undefined;
			if (configuration.auth && request.headers.has("Authorization")) {
				const authorization = request.headers.get("Authorization") ?? "";
				const [, scheme, accessToken] =
					authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/) ?? [];
				if (scheme === "Bearer") {
					try {
						const { payload } = await jwtVerify(
							accessToken,
							configuration.auth.keys.publicKey,
						);
						if (isAutoId(payload.sub, SESSION_AUTOID_PREFIX)) {
							const sessionData = await providers.session.get(
								payload.sub,
							).catch((
								_,
							) => undefined);
							if (sessionData) {
								const { scope, aat } = { ...payload, scope: "", aat: 0 };
								authenticationToken = {
									lastAuthorizationTime: aat,
									scope: scope.split(/ +/),
									sessionData,
								};
							}
						} else {
							logger.warn(
								`Expected authorization JWT.sub to be an identity ID, got ${payload.sub}.`,
							);
						}
					} catch (error) {
						logger.warn(
							`Could not parse authorization header, got error : ${error}`,
						);
					}
				} else {
					logger.warn(`Unknown authorization scheme ${scheme}.`);
				}
			}

			const context: IContext = {
				get config() {
					return configuration;
				},
				get authenticationToken() {
					return authenticationToken;
				},
				get asset() {
					return new AssetService(providers.asset);
				},
				get counter() {
					return new CounterService(providers.counter);
				},
				get kv() {
					return new KVService(providers.kv);
				},
				get document() {
					return new DocumentService(providers.document);
				},
				get identity() {
					return new IdentityService(
						providers.identity,
						context,
					);
				},
				get session() {
					return new SessionService(providers.session);
				},
				get auth() {
					return new AuthenticationService(context);
				},
				waitUntil(promise: PromiseLike<void>): void {
					waitUntil.push(promise);
				},
			};
			return context;
		});

	// TODO: fix compiled router to allow for this
	// .get("/{...path}", ({ request, asset }) => asset.fetch(request));

	if (configuration.auth) {
		app = app
			.get("/authenticationCeremony", ({ auth }) => {
				return Response.json(auth.getAuthenticationCeremony());
			}, {
				summary: "Get the authentication ceremony",
				tags: ["Authentication"],
			})
			.post("/authenticationCeremony", async ({ body, auth, config }) => {
				const state = await decryptEncryptedAuthenticationCeremonyState(
					body.state,
					config.auth!.keys.publicKey,
				);
				return Response.json(auth.getAuthenticationCeremony(state));
			}, {
				summary: "Get the authentication ceremony from an encrypted state",
				tags: ["Authentication"],
				body: t.Object({
					state: t.Referenceable(
						"AuthenticationEncryptedState",
						t.Describe("An authentication encrypted state", t.String()),
					),
				}, ["state"]),
			});
	}
	return app;
}
