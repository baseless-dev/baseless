import type { IdentityProvider } from "../identity.ts";
import OAuth2AuthentificationComponent from "./mod.ts";

export default class GoogleAuthentificationIdenticator
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
			authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
			tokenUrl: "https://oauth2.googleapis.com/token",
			scope: "https://www.googleapis.com/auth/userinfo.profile",
		});
	}
	async retrieveIdentification(access_token: string): Promise<string> {
		const response = await fetch(
			"https://www.googleapis.com/oauth2/v3/userinfo",
			{
				headers: {
					Authorization: `Bearer ${access_token}`,
				},
			},
		);
		const data = await response.json();
		if (
			data && typeof data === "object" && "sub" in data &&
			typeof data.sub === "string"
		) {
			return data.sub.toString();
		}
		throw new Error("Invalid response.");
	}
}
