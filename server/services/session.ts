import { SessionData } from "../../common/session/data.ts";
import {
	SessionCreateError,
	SessionDestroyError,
	SessionIDNotFoundError,
} from "../../common/session/errors.ts";
import { AutoId } from "../../common/system/autoid.ts";
import { PromisedResult } from "../../common/system/result.ts";
import { SessionProvider } from "../../providers/session.ts";
import { Configuration } from "../config.ts";

export class SessionService {
	#configuration: Configuration;
	#sessionProvider: SessionProvider;

	constructor(
		configuration: Configuration,
		sessionProvider: SessionProvider,
	) {
		this.#configuration = configuration;
		this.#sessionProvider = sessionProvider;
	}

	get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): PromisedResult<SessionData<Meta>, SessionIDNotFoundError> {
		return this.#sessionProvider.get(sessionId);
	}

	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): PromisedResult<SessionData, SessionCreateError> {
		// TODO rate limit
		// TODO expiration ??= this.#configuration.auth.session.expiration;
		return this.#sessionProvider.create(identityId, meta, expiration);
	}

	destroy(sessionId: AutoId): PromisedResult<void, SessionDestroyError> {
		// TODO rate limit
		return this.#sessionProvider.destroy(sessionId);
	}

	list(identityId: AutoId): PromisedResult<SessionData[], never> {
		return this.#sessionProvider.list(identityId);
	}
}
