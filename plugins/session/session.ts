import type { AutoId } from "../../lib/autoid.ts";
import type { SessionData } from "../../lib/session/types.ts";
import type { SessionProvider } from "../../providers/session/provider.ts";

export class SessionService {
	#identityProvider: SessionProvider;

	constructor(identityProvider: SessionProvider) {
		this.#identityProvider = identityProvider;
	}

	get(sessionId: AutoId): Promise<SessionData> {
		return this.#identityProvider.get(sessionId);
	}

	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData> {
		return this.#identityProvider.create(identityId, meta, expiration);
	}

	update(sessionData: SessionData, expiration?: number | Date): Promise<void> {
		return this.#identityProvider.update(sessionData, expiration);
	}

	destroy(sessionId: AutoId): Promise<void> {
		return this.#identityProvider.destroy(sessionId);
	}

	list(identityId: AutoId): Promise<AutoId[]> {
		return this.#identityProvider.list(identityId);
	}
}
