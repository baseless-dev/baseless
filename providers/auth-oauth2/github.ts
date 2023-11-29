import OAuth2AuthentificationIdenticator from "./mod.ts";

export default class GithubAuthentificationIdenticator
	extends OAuth2AuthentificationIdenticator {
	constructor(id: string, options: { clientId: string; clientSecret: string }) {
		super(id, {
			...options,
			authorizationUrl:
				"https://github.com/login/oauth/authorize?scope=https%3A%2F%2Fwww%2Egoogleapis%2Ecom%2Fauth%2Fuserinfo%2Eprofile",
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
