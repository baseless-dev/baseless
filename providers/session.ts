import type { SessionData } from "../common/session/data.ts";
import type {
	SessionCreateError,
	SessionDestroyError,
	SessionIDNotFoundError,
	SessionUpdateError,
} from "../common/session/errors.ts";
import type { AutoId } from "../common/system/autoid.ts";

export interface SessionProvider {
	/**
	 * @throws {SessionIDNotFoundError}
	 */
	get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): Promise<SessionData<Meta>>;

	/**
	 * @throws {SessionCreateError}
	 */
	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData>;

	/**
	 * @throws {SessionUpdateError}
	 */
	update(sessionData: SessionData): Promise<void>;

	/**
	 * @throws {SessionDestroyError}
	 */
	destroy(sessionId: AutoId): Promise<void>;

	list(identityId: AutoId): Promise<SessionData[]>;
}
