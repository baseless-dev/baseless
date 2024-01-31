import type { AutoId } from "../../lib/autoid.ts";
import type { SessionData } from "../../lib/session/types.ts";
import type { SessionProvider } from "../../providers/session.ts";

export class SessionService {
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
