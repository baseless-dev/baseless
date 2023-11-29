import { encode } from "../../common/encoding/base64.ts";
import {
	AuthenticationChallenger,
	type AuthenticationChallengerConfigureIdentityChallengeOptions,
	type AuthenticationChallengerSendChallengeOptions,
	type AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";
import type { AuthenticationCeremonyComponentChallenge } from "../../common/auth/ceremony/ceremony.ts";

export default class PasswordAuthentificationChallenger
	extends AuthenticationChallenger {
	constructor(id: string) {
		super(id);
	}
	async #hashPassword(password: string): Promise<string> {
		return encode(
			await crypto.subtle.digest("SHA-512", new TextEncoder().encode(password)),
		);
	}
	ceremonyComponent(): AuthenticationCeremonyComponentChallenge {
		return {
			id: this.id,
			kind: "challenge",
			prompt: "password",
		};
	}
	async configureIdentityChallenge(
		{ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions,
	): Promise<Record<string, unknown>> {
		const hash = await this.#hashPassword(`${challenge}`);
		return { hash };
	}
	async sendChallenge(
		_options: AuthenticationChallengerSendChallengeOptions,
	): Promise<void> {}
	async verify(
		{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions,
	): Promise<boolean> {
		const hash = await this.#hashPassword(`${challenge}`);
		return "hash" in identityChallenge.meta &&
			identityChallenge.meta.hash === hash;
	}
}
