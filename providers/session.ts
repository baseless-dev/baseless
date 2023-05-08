import type { SessionData } from "../common/session/data.ts";
import type { SessionCreateError, SessionDestroyError, SessionIDNotFoundError, SessionUpdateError } from "../common/session/errors.ts";
import type { AutoId } from "../common/system/autoid.ts";
import type { PromisedResult } from "../common/system/result.ts";

export interface SessionProvider {
	get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): PromisedResult<SessionData<Meta>, SessionIDNotFoundError>;
	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): PromisedResult<SessionData, SessionCreateError>;
	update(sessionData: SessionData): PromisedResult<void, SessionUpdateError>;
	destroy(sessionId: AutoId): PromisedResult<void, SessionDestroyError>;
	list(identityId: AutoId): PromisedResult<SessionData[], never>;
}

