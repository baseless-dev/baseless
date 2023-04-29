import { AutoId, assertAutoId, autoid } from "../../shared/autoid.ts";
import { createLogger } from "../../server/logger.ts";
import { KVProvider } from "../../server/providers/kv.ts";
import {
	assertSessionData,
	isSessionData,
	SessionData,
	SessionProvider,
} from "../../server/providers/session.ts";

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
	): Promise<SessionData<Meta>> {
		assertAutoId(sessionId);
		const result = await this.#kvProvider.get(`/byId/${sessionId}`);
		const sessionData = JSON.parse(result.value);
		assertSessionData(sessionData);
		return sessionData as SessionData<Meta>;
	}

	async create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData> {
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
	}

	async update(sessionData: SessionData): Promise<void> {
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
	}

	async destroy(sessionId: AutoId): Promise<void> {
		assertAutoId(sessionId);
		const sessionData = await this.get(sessionId);
		await Promise.all([
			this.#kvProvider.delete(`/byId/${sessionData.id}`),
			this.#kvProvider.delete(
				`/byIdentity/${sessionData.identityId}/${sessionData.id}`,
			),
		]);
	}

	async list(identityId: AutoId): Promise<SessionData[]> {
		assertAutoId(identityId);
		const result = await this.#kvProvider.list({
			prefix: `/byIdentity/${identityId}`,
		});
		return result.keys.map((key) => JSON.parse(key.value)).filter(
			isSessionData,
		);
	}
}
