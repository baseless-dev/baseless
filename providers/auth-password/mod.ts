import { encode } from "../../common/encoding/base64.ts";
import type {
	AuthenticationChallenger,
	AuthenticationChallengerConfigureIdentityChallengeOptions,
	AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";
import type { IdentityChallenge } from "../../common/identity/challenge.ts";

// deno-lint-ignore explicit-function-return-type
export function PasswordAuthentificationChallenger() {
	async function hashPassword(password: string): Promise<string> {
		return encode(
			await crypto.subtle.digest("SHA-512", new TextEncoder().encode(password)),
		);
	}
	return {
		kind: "challenge",
		id: "password",
		prompt: "password",
		rateLimit: { count: 0, interval: 0 },
		async configureIdentityChallenge(
			{ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions,
		): Promise<IdentityChallenge["meta"]> {
			const hash = await hashPassword(challenge);
			return { hash };
		},
		async verify(
			{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions,
		): Promise<boolean> {
			const hash = await hashPassword(challenge);
			return "hash" in identityChallenge.meta &&
				identityChallenge.meta.hash === hash;
		},
	} satisfies AuthenticationChallenger;
}
