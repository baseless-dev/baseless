import type { SessionData } from "../common/session/data.ts";
import type {
	SessionCreateError,
	SessionDestroyError,
	SessionIDNotFoundError,
	SessionUpdateError,
} from "../common/session/errors.ts";
import type { AutoId } from "../common/system/autoid.ts";
import type { Result } from "../common/system/result.ts";

export interface SessionProvider {
	get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): Promise<Result<SessionData<Meta>, SessionIDNotFoundError>>;
	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<Result<SessionData, SessionCreateError>>;
	update(sessionData: SessionData): Promise<Result<void, SessionUpdateError>>;
	destroy(sessionId: AutoId): Promise<Result<void, SessionDestroyError>>;
	list(identityId: AutoId): Promise<Result<SessionData[], never>>;
}
