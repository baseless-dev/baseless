import { encode } from "https://deno.land/std@0.179.0/encoding/base64.ts";
import { AuthenticationChallenger, AuthenticationChallengerConfigureIdentityChallengeOptions, AuthenticationChallengerVerifyOptions } from "../../common/auth/challenger.ts";
import { IdentityChallenge } from "../../common/identity/challenge.ts";

export class PasswordAuthentificationChallenger
	extends AuthenticationChallenger {
	async #hash(password: string) {
		return encode(
			await crypto.subtle.digest("SHA-512", new TextEncoder().encode(password)),
		);
	}

	configureIdentityChallenge = async ({ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions) => {
		const hash = await this.#hash(challenge);
		return { hash };
	}

	async verify(
		{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions
	): Promise<boolean> {
		const hash = await this.#hash(challenge);
		return "hash" in identityChallenge.meta &&
			identityChallenge.meta.hash === hash;
	}
}
