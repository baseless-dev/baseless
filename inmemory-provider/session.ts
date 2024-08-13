// deno-lint-ignore-file require-await
import { Session, SessionNotFoundError, SessionProvider } from "@baseless/server/provider";

export class MemorySessionProvider extends SessionProvider {
	#storage = new Map<string, { value: Session; expiration?: number }>();

	async get(sessionId: Session["sessionId"]): Promise<Session> {
		const item = this.#storage.get(sessionId);
		if (!item || (item.expiration && item.expiration < new Date().getTime())) {
			throw new SessionNotFoundError();
		}
		return Promise.resolve(item.value);
	}

	async set(
		session: Session,
		expiration?: number | Date,
	): Promise<void> {
		const now = new Date().getTime();
		const exp = expiration
			? expiration instanceof Date ? expiration.getTime() : expiration + now
			: undefined;
		const item = { value: session, expiration: exp };
		this.#storage.set(session.sessionId, item);
	}

	async delete(sessionId: Session["sessionId"]): Promise<void> {
		this.#storage.delete(sessionId);
	}
}
