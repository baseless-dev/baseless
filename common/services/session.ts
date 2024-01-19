import type { SessionData } from "../session/data.ts";
import type { AutoId } from "../system/autoid.ts";
import {
	// deno-lint-ignore no-unused-vars
	SessionCreateError,
	// deno-lint-ignore no-unused-vars
	SessionDestroyError,
	// deno-lint-ignore no-unused-vars
	SessionIDNotFoundError,
	// deno-lint-ignore no-unused-vars
	SessionUpdateError,
} from "../session/errors.ts";

export interface ISessionService {
	/**
	 * @throws {SessionIDNotFoundError}
	 */
	get(sessionId: AutoId): Promise<SessionData>;

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
	update(
		sessionData: SessionData,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {SessionDestroyError}
	 */
	destroy(sessionId: AutoId): Promise<void>;

	list(identityId: AutoId): Promise<AutoId[]>;
}
