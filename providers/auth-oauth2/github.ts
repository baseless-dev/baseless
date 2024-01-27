import type { IdentityProvider } from "../identity.ts";
import OAuth2AuthentificationComponent from "./mod.ts";

export default class GithubAuthentificationIdenticator
	extends OAuth2AuthentificationComponent {
	constructor(
		id: string,
		identityProvider: IdentityProvider,
		options: {
			clientId: string;
			clientSecret: string;
			redirectUrl: string | URL;
		},
	) {
		super(id, identityProvider, {
			...options,
			authorizationUrl: "https://github.com/login/oauth/authorize",
			tokenUrl: "https://github.com/login/oauth/access_token",
		});
	}
	async retrieveIdentification(access_token: string): Promise<string> {
		const response = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${access_token}`,
			},
		});
		const data = await response.json();
		if (
			data && typeof data === "object" && "id" in data &&
			typeof data.id === "number"
		) {
			return data.id.toString();
		}
		throw new Error("Invalid response.");
	}
}
