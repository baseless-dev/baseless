// deno-lint-ignore-file require-await
import {
	Session,
	SessionNotFoundError,
	SessionProvider,
	SessionPutError,
} from "@baseless/server/provider";

export class DenoKVSessionProvider extends SessionProvider {
	#storage: Deno.Kv;

	constructor(
		storage: Deno.Kv,
	) {
		super();
		this.#storage = storage;
	}

	async get(sessionId: Session["sessionId"]): Promise<Session> {
		const key = ["session", sessionId];
		const now = new Date().getTime();
		const entry = await this.#storage.get<
			{ value: Session; expiration: number }
		>(
			key,
			{
				consistency: "strong",
			},
		);
		if (
			entry.versionstamp && entry.value &&
			(!entry.value.expiration || entry.value.expiration > now)
		) {
			return entry.value.value;
		}
		throw new SessionNotFoundError();
	}

	async set(
		session: Session,
		expiration?: number | Date,
	): Promise<void> {
		const key = ["session", session.sessionId];
		const expireIn = expiration
			? expiration instanceof Date ? expiration.getTime() - new Date().getTime() : expiration
			: undefined;
		const exp = expiration
			? expiration instanceof Date ? expiration.getTime() : expiration + new Date().getTime()
			: undefined;
		const result = await this.#storage.set(key, { value: session, expiration: exp }, {
			expireIn,
		});
		if (!result.ok) {
			throw new SessionPutError();
		}
	}

	async delete(sessionId: Session["sessionId"]): Promise<void> {
		const key = ["session", sessionId];
		return this.#storage.delete(key);
	}
}
