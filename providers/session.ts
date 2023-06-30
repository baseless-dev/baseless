import type { SessionData } from "../common/session/data.ts";
import type {
	// deno-lint-ignore no-unused-vars
	SessionCreateError,
	// deno-lint-ignore no-unused-vars
	SessionDestroyError,
	// deno-lint-ignore no-unused-vars
	SessionIDNotFoundError,
	// deno-lint-ignore no-unused-vars
	SessionUpdateError,
} from "../common/session/errors.ts";
import type { AutoId } from "../common/system/autoid.ts";

export interface SessionProvider {
	/**
	 * @throws { SessionIDNotFoundError}
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
	update(sessionData: SessionData, expiration?: number | Date): Promise<void>;

	/**
	 * @throws {SessionDestroyError}
	 */
	destroy(sessionId: AutoId): Promise<void>;

	list(identityId: AutoId): Promise<SessionData[]>;
}
