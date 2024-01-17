import type { ISessionService } from "../../common/server/services/session.ts";
import type { SessionData } from "../../common/session/data.ts";
import {
	// deno-lint-ignore no-unused-vars
	SessionCreateError,
	// deno-lint-ignore no-unused-vars
	SessionDestroyError,
	// deno-lint-ignore no-unused-vars
	SessionIDNotFoundError,
	// deno-lint-ignore no-unused-vars
	SessionUpdateError,
} from "../../common/session/errors.ts";
import type { AutoId } from "../../common/system/autoid.ts";
import type { SessionProvider } from "../../providers/session.ts";

export class SessionService implements ISessionService {
	#sessionProvider: SessionProvider;

	constructor(
		sessionProvider: SessionProvider,
	) {
		this.#sessionProvider = sessionProvider;
	}

	/**
	 * @throws {SessionIDNotFoundError}
	 */
	get(sessionId: AutoId): Promise<SessionData> {
		return this.#sessionProvider.get(sessionId);
	}

	/**
	 * @throws {SessionCreateError}
	 */
	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData> {
		// TODO rate limit
		return this.#sessionProvider.create(identityId, meta, expiration);
	}

	/**
	 * @throws {SessionUpdateError}
	 */
	update(
		sessionData: SessionData,
		expiration?: number | Date,
	): Promise<void> {
		// TODO rate limit
		return this.#sessionProvider.update(sessionData, expiration);
	}

	/**
	 * @throws {SessionDestroyError}
	 */
	destroy(sessionId: AutoId): Promise<void> {
		// TODO rate limit
		return this.#sessionProvider.destroy(sessionId);
	}

	list(identityId: AutoId): Promise<AutoId[]> {
		return this.#sessionProvider.list(identityId);
	}
}
