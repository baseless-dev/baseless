import type { SessionProvider } from "../../providers/session.ts";

export class SessionConfiguration {
	#sessionProvider?: SessionProvider;

	constructor(sessionProvider?: SessionProvider) {
		this.#sessionProvider = sessionProvider;
	}

	setSessionProvider(
		sessionProvider: SessionProvider,
	): SessionConfiguration {
		return new SessionConfiguration(sessionProvider);
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#sessionProvider) {
			throw new Error("A session provider must be provided.");
		}
		return Object.freeze({
			sessionProvider: this.#sessionProvider,
		});
	}
}
