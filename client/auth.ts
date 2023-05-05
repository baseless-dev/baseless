import { App, assertApp } from "./app.ts";

export interface AuthApp extends App {
	readonly tokens: undefined | {
		access_token: string;
		refresh_token?: string;
		id_token: string;
	};
}

export function getAuth(app: App): AuthApp {
	assertApp(app);
	return {
		clientId: app.clientId,
		tokens: undefined,
		fetch(input: URL | Request | string, init?: RequestInit) {
			const headers = new Headers(init?.headers);
			if (this.tokens?.access_token) {
				headers.set("Authorization", `Bearer ${this.tokens.access_token}`);
			}
			return app.fetch(input, { ...init, headers });
		},
	};
}
