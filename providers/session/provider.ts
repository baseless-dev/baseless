import type { AutoId } from "../../lib/autoid.ts";
import type { SessionData } from "../../lib/session/types.ts";

export interface SessionProvider {
	get(sessionId: AutoId): Promise<SessionData>;

	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData>;

	update(sessionData: SessionData, expiration?: number | Date): Promise<void>;

	destroy(sessionId: AutoId): Promise<void>;

	list(identityId: AutoId): Promise<AutoId[]>;
}
