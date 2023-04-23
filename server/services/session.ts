import { AutoId } from "../../shared/autoid.ts";
import { Configuration } from "../config.ts";
import { SessionData, SessionProvider } from "../providers/session.ts";

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
	): Promise<SessionData<Meta>> {
		return this.#sessionProvider.get(sessionId);
	}

	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData> {
		// TODO expiration ??= this.#configuration.auth.session.expiration;
		return this.#sessionProvider.create(identityId, meta, expiration);
	}

	destroy(sessionId: AutoId): Promise<void> {
		return this.#sessionProvider.destroy(sessionId);
	}

	list(identityId: AutoId): Promise<SessionData[]> {
		return this.#sessionProvider.list(identityId);
	}
}
