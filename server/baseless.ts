import { Router } from "../common/router/router.ts";
import type { Configuration } from "../common/server/config/config.ts";
import type { IAssetService } from "../common/server/services/asset.ts";
import type { IAuthenticationService } from "../common/server/services/auth.ts";
import type { ICounterService } from "../common/server/services/counter.ts";
import type { IDocumentService } from "../common/server/services/document.ts";
import type { IIdentityService } from "../common/server/services/identity.ts";
import type { IKVService } from "../common/server/services/kv.ts";
import type { ISessionService } from "../common/server/services/session.ts";
import type { TokenData } from "../common/server/token_data.ts";
export { Router } from "../common/router/router.ts";
export * as t from "../common/schema/mod.ts";
export * as c from "../common/auth/ceremony/component/helpers.ts";

export type BaselessContext = {
	readonly remoteAddress: string;
	readonly tokenData: TokenData | undefined;
	readonly asset: IAssetService;
	readonly counter: ICounterService;
	readonly kv: IKVService;
	readonly document: IDocumentService;
	readonly identity: IIdentityService;
	readonly session: ISessionService;
	readonly auth: IAuthenticationService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
};

export default function baseless(): Router<[BaselessContext]> {
	return new Router();
}
