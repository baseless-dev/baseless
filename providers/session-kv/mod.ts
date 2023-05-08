import { SessionData, assertSessionData, isSessionData } from "../../common/session/data.ts";
import { SessionCreateError, SessionDestroyError, SessionIDNotFoundError, SessionUpdateError } from "../../common/session/errors.ts";
import { AutoId, InvalidAutoIdError, assertAutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { PromisedResult, assertResultOk, err, ok, unwrap } from "../../common/system/result.ts";
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

	async get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): PromisedResult<SessionData<Meta>, SessionIDNotFoundError> {
		try {
			assertAutoId(sessionId);
			const result = await this.#kvProvider.get(`/byId/${sessionId}`);
			assertResultOk(result);
			const sessionData = JSON.parse(result.value.value);
			assertSessionData(sessionData);
			return ok(sessionData as SessionData<Meta>);
		} catch (inner) {
			this.#logger.error(`Failed to get session ${sessionId}, got ${inner}`);
		}
		return err(new SessionIDNotFoundError());
	}

	async create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): PromisedResult<SessionData, SessionCreateError> {
		try {
			assertAutoId(identityId);
			const id = autoid();
			const sessionData: SessionData = {
				id,
				identityId,
				meta,
			};
			const results = await Promise.all([
				this.#kvProvider.put(`/byId/${id}`, JSON.stringify(sessionData), {
					expiration,
				}),
				this.#kvProvider.put(
					`/byIdentity/${identityId}/${id}`,
					JSON.stringify(sessionData),
					{ expiration },
				),
			]);
			for (const result of results) {
				assertResultOk(result);
			}
			return ok(sessionData);
		} catch (inner) {
			this.#logger.error(`Failed to create session, got ${inner}`);
		}
		return err(new SessionCreateError());
	}

	async update(sessionData: SessionData): PromisedResult<void, SessionUpdateError> {
		try {
			assertSessionData(sessionData);
			const results = await Promise.all([
				this.#kvProvider.put(
					`/byId/${sessionData.id}`,
					JSON.stringify(sessionData),
				),
				this.#kvProvider.put(
					`/byIdentity/${sessionData.identityId}/${sessionData.id}`,
					JSON.stringify(sessionData),
				),
			]);
			for (const result of results) {
				assertResultOk(result);
			}
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to update session ${sessionData.id}, got ${inner}`);
		}
		return err(new SessionUpdateError());
	}

	async destroy(sessionId: AutoId): PromisedResult<void, SessionDestroyError> {
		try {
			assertAutoId(sessionId);
			const sessionData = unwrap(await this.get(sessionId));
			const results = await Promise.all([
				this.#kvProvider.delete(`/byId/${sessionData.id}`),
				this.#kvProvider.delete(
					`/byIdentity/${sessionData.identityId}/${sessionData.id}`,
				),
			]);
			for (const result of results) {
				assertResultOk(result);
			}
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to destroy session ${sessionId}, got ${inner}`);
		}
		return err(new SessionDestroyError());
	}

	async list(identityId: AutoId): PromisedResult<SessionData[], never> {
		try {
			assertAutoId(identityId);
			const result = unwrap(await this.#kvProvider.list({
				prefix: `/byIdentity/${identityId}`,
			}));
			return ok(result.keys.map((key) => JSON.parse(key.value)).filter(
				isSessionData,
			));
		} catch (inner) {
			this.#logger.error(`Failed to list sessions for identity ${identityId}, got ${inner}`);
		}
		return ok([]);
	}
}
