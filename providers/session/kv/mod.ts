import {
	assertAutoId,
	type AutoId,
	isAutoId,
	ruid,
} from "../../../lib/autoid.ts";
import { IDENTITY_AUTOID_PREFIX } from "../../../lib/identity/types.ts";
import { createLogger } from "../../../lib/logger.ts";
import {
	SessionCreateError,
	SessionDestroyError,
	SessionIDNotFoundError,
	SessionUpdateError,
} from "../../../lib/session/errors.ts";
import {
	SESSION_AUTOID_PREFIX,
	type SessionData,
} from "../../../lib/session/types.ts";
import type { KVProvider } from "../../kv/provider.ts";
import type { SessionProvider } from "../provider.ts";

export class KVSessionProvider implements SessionProvider {
	#logger = createLogger("session-kv");
	#kvProvider: KVProvider;

	public constructor(kv: KVProvider) {
		this.#kvProvider = kv;
	}

	async get(sessionId: AutoId): Promise<SessionData> {
		try {
			assertAutoId(sessionId, SESSION_AUTOID_PREFIX);
			const result = await this.#kvProvider.get(["byId", sessionId]);
			const sessionData = JSON.parse(result.value);
			return sessionData as SessionData;
		} catch (inner) {
			this.#logger.error(`Failed to get session ${sessionId}, got ${inner}`);
		}
		throw new SessionIDNotFoundError();
	}

	async create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData> {
		try {
			assertAutoId(identityId, IDENTITY_AUTOID_PREFIX);
			const id = ruid(SESSION_AUTOID_PREFIX);
			const sessionData: SessionData = {
				id,
				identityId,
				meta,
			};
			await Promise.all([
				this.#kvProvider.put(["byId", id], JSON.stringify(sessionData), {
					expiration,
				}),
				this.#kvProvider.put(
					["byIdentity", identityId, id],
					JSON.stringify(sessionData),
					{ expiration },
				),
			]);
			return sessionData;
		} catch (inner) {
			this.#logger.error(`Failed to create session, got ${inner}`);
		}
		throw new SessionCreateError();
	}

	async update(
		sessionData: SessionData,
		expiration?: number | Date,
	): Promise<void> {
		try {
			await Promise.all([
				this.#kvProvider.put(
					["byId", sessionData.id],
					JSON.stringify(sessionData),
					{ expiration },
				),
				this.#kvProvider.put(
					["byIdentity", sessionData.identityId, sessionData.id],
					JSON.stringify(sessionData),
					{ expiration },
				),
			]);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to update session ${sessionData.id}, got ${inner}`,
			);
		}
		throw new SessionUpdateError();
	}

	async destroy(sessionId: AutoId): Promise<void> {
		try {
			assertAutoId(sessionId, SESSION_AUTOID_PREFIX);
			const sessionData = await this.get(sessionId);
			await Promise.all([
				this.#kvProvider.delete(["byId", sessionData.id]),
				this.#kvProvider.delete(
					["byIdentity", sessionData.identityId, sessionData.id],
				),
			]);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to destroy session ${sessionId}, got ${inner}`,
			);
		}
		throw new SessionDestroyError();
	}

	async list(identityId: AutoId): Promise<AutoId[]> {
		try {
			assertAutoId(identityId, IDENTITY_AUTOID_PREFIX);
			const result = await this.#kvProvider.list({
				prefix: ["byIdentity", identityId],
			});
			return result.keys.map((key) => key.key.at(-1)).filter((
				id,
			): id is AutoId => isAutoId(id, SESSION_AUTOID_PREFIX));
		} catch (inner) {
			this.#logger.error(
				`Failed to list sessions for identity ${identityId}, got ${inner}`,
			);
		}
		return [];
	}
}
