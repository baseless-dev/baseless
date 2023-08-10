import { encode } from "../../common/encoding/base64.ts";
import {
	AuthenticationChallenger,
	type AuthenticationChallengerConfigureIdentityChallengeOptions,
	type AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";

export class PasswordAuthentificationChallenger
	extends AuthenticationChallenger {
	id = "password";
	prompt = "password" as const;

	async #hash(password: string): Promise<string> {
		return encode(
			await crypto.subtle.digest("SHA-512", new TextEncoder().encode(password)),
		);
	}

	configureIdentityChallenge = async (
		{ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions,
	) => {
		const hash = await this.#hash(challenge);
		return { hash };
	};

	async verify(
		{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions,
	): Promise<boolean> {
		const hash = await this.#hash(challenge);
		return "hash" in identityChallenge.meta &&
			identityChallenge.meta.hash === hash;
	}
}
