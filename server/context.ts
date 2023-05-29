import type { Configuration } from "../common/server/config/config.ts";
import type { IContext } from "../common/server/context.ts";
import type { IAssetService } from "../common/server/services/asset.ts";
import type { IAuthenticationService } from "../common/server/services/auth.ts";
import type { ICounterService } from "../common/server/services/counter.ts";
import type { IIdentityService } from "../common/server/services/identity.ts";
import type { IKVService } from "../common/server/services/kv.ts";
import type { ISessionService } from "../common/server/services/session.ts";
import type { SessionData } from "../common/session/data.ts";
import type { AssetProvider } from "../providers/asset.ts";
import type { CounterProvider } from "../providers/counter.ts";
import type { IdentityProvider } from "../providers/identity.ts";
import type { KVProvider } from "../providers/kv.ts";
import type { SessionProvider } from "../providers/session.ts";
import { AssetService } from "./services/asset.ts";
import { AuthenticationService } from "./services/auth.ts";
import { CounterService } from "./services/counter.ts";
import { IdentityService } from "./services/identity.ts";
import { KVService } from "./services/kv.ts";
import { SessionService } from "./services/session.ts";

/**
 * Baseless's context
 */
export class Context implements IContext {
	#waitUntil: PromiseLike<unknown>[];
	#remoteAddress: string;
	#sessionData: SessionData | undefined;
	#configuration: Configuration;
	#assetProvider: AssetProvider;
	#counterProvider: CounterProvider;
	#kvProvider: KVProvider;
	#identityProvider: IdentityProvider;
	#sessionProvider: SessionProvider;
	constructor(
		waitUntil: PromiseLike<unknown>[],
		remoteAddress: string,
		sessionData: SessionData | undefined,
		configuration: Configuration,
		assetProvider: AssetProvider,
		counterProvider: CounterProvider,
		kvProvider: KVProvider,
		identityProvider: IdentityProvider,
		sessionProvider: SessionProvider,
	) {
		this.#waitUntil = waitUntil;
		this.#remoteAddress = remoteAddress;
		this.#sessionData = sessionData;
		this.#configuration = configuration;
		this.#assetProvider = assetProvider;
		this.#counterProvider = counterProvider;
		this.#kvProvider = kvProvider;
		this.#identityProvider = identityProvider;
		this.#sessionProvider = sessionProvider;
	}
	get remoteAddress(): string {
		return this.#remoteAddress;
	}
	get currentSessionData(): SessionData | undefined {
		return this.#sessionData;
	}
	get config(): Configuration {
		return this.#configuration;
	}
	get asset(): IAssetService {
		return new AssetService(this.#assetProvider);
	}
	get counter(): ICounterService {
		return new CounterService(this.#counterProvider);
	}
	get kv(): IKVService {
		return new KVService(this.#kvProvider);
	}
	get identity(): IIdentityService {
		return new IdentityService(this.#identityProvider, this);
	}
	get session(): ISessionService {
		return new SessionService(this.#sessionProvider, this);
	}
	get auth(): IAuthenticationService {
		return new AuthenticationService(this);
	}

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void {
		this.#waitUntil.push(promise);
	}
}
