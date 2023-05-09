import { SessionData } from "../../common/session/data.ts";
import {
	SessionCreateError,
	SessionDestroyError,
	SessionIDNotFoundError,
} from "../../common/session/errors.ts";
import { AutoId } from "../../common/system/autoid.ts";
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

	/**
	 * @throws {SessionIDNotFoundError}
	 */
	get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): Promise<SessionData<Meta>> {
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
		// TODO expiration ??= this.#configuration.auth.session.expiration;
		return this.#sessionProvider.create(identityId, meta, expiration);
	}

	/**
	 * @throws {SessionDestroyError}
	 */
	destroy(sessionId: AutoId): Promise<void> {
		// TODO rate limit
		return this.#sessionProvider.destroy(sessionId);
	}

	list(identityId: AutoId): Promise<SessionData[]> {
		return this.#sessionProvider.list(identityId);
	}
}
