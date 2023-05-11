import {
	assertSessionData,
	isSessionData,
	SessionData,
} from "../../common/session/data.ts";
import {
	SessionCreateError,
	SessionDestroyError,
	SessionIDNotFoundError,
	SessionUpdateError,
} from "../../common/session/errors.ts";
import { assertAutoId, AutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { KVProvider } from "../kv.ts";
import { SessionProvider } from "../session.ts";

export class KVSessionProvider implements SessionProvider {
	#logger = createLogger("session-kv");
	#kvProvider: KVProvider;
	#prefix: string;

	public constructor(
		kv: KVProvider,
		prefix = "sessions",
	) {
		this.#kvProvider = kv;
		this.#prefix = prefix;
	}

	/**
	 * @throws {SessionIDNotFoundError}
	 */
	async get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): Promise<SessionData<Meta>> {
		try {
			assertAutoId(sessionId);
			const result = await this.#kvProvider.get(`/byId/${sessionId}`);
			const sessionData = JSON.parse(result.value);
			assertSessionData(sessionData);
			return sessionData as SessionData<Meta>;
		} catch (inner) {
			this.#logger.error(`Failed to get session ${sessionId}, got ${inner}`);
		}
		throw new SessionIDNotFoundError();
	}

	/**
	 * @throws {SessionCreateError}
	 */
	async create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData> {
		try {
			assertAutoId(identityId);
			const id = autoid();
			const sessionData: SessionData = {
				id,
				identityId,
				meta,
			};
			await Promise.all([
				this.#kvProvider.put(`/byId/${id}`, JSON.stringify(sessionData), {
					expiration,
				}),
				this.#kvProvider.put(
					`/byIdentity/${identityId}/${id}`,
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

	/**
	 * @throws {SessionUpdateError}
	 */
	async update(
		sessionData: SessionData,
	): Promise<void> {
		try {
			assertSessionData(sessionData);
			await Promise.all([
				this.#kvProvider.put(
					`/byId/${sessionData.id}`,
					JSON.stringify(sessionData),
				),
				this.#kvProvider.put(
					`/byIdentity/${sessionData.identityId}/${sessionData.id}`,
					JSON.stringify(sessionData),
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

	/**
	 * @throws {SessionDestroyError}
	 */
	async destroy(sessionId: AutoId): Promise<void> {
		try {
			assertAutoId(sessionId);
			const sessionData = await this.get(sessionId);
			await Promise.all([
				this.#kvProvider.delete(`/byId/${sessionData.id}`),
				this.#kvProvider.delete(
					`/byIdentity/${sessionData.identityId}/${sessionData.id}`,
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

	async list(identityId: AutoId): Promise<SessionData[]> {
		try {
			assertAutoId(identityId);
			const result = await this.#kvProvider.list({
				prefix: `/byIdentity/${identityId}`,
			});
			return result.keys.map((key) => JSON.parse(key.value)).filter(
				isSessionData,
			);
		} catch (inner) {
			this.#logger.error(
				`Failed to list sessions for identity ${identityId}, got ${inner}`,
			);
		}
		return [];
	}
}
