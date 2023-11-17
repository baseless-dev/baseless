import type {
	AuthenticationChallenger,
	AuthenticationChallengerConfigureIdentityChallengeOptions,
	AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";
import type { IdentityChallenge } from "../../common/identity/challenge.ts";
import {
	assertTOTPOptions,
	totp,
	type TOTPOptions,
} from "../../common/system/otp.ts";

// deno-lint-ignore explicit-function-return-type
export function TOTPAuthentificationChallenger(
	id: string,
	options: Omit<TOTPOptions, "key">,
) {
	assertTOTPOptions({ ...options, key: "" });
	return {
		kind: "challenge",
		id,
		prompt: "totp",
		digits: options.digits ?? 6,
		timeout: options.period,
		rateLimit: { count: 0, interval: 0 },
		async configureIdentityChallenge(
			{ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions,
		): Promise<IdentityChallenge["meta"]> {
			try {
				const _ = await totp({
					digits: 6,
					period: 60,
					key: challenge,
					time: Date.now(),
				});
			} catch (_error) {
				throw new Error("Invalid TOTP key");
			}
			return { key: challenge };
		},
		async verify(
			{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions,
		): Promise<boolean> {
			if (
				"key" in identityChallenge.meta &&
				typeof identityChallenge.meta.key === "string"
			) {
				for (const offset of [-30, 0, 30]) {
					const code = await totp({
						...options,
						key: identityChallenge.meta.key,
						time: Date.now() / 1000 + offset,
					});
					if (code === challenge) {
						return true;
					}
				}
				return false;
			}
			return false;
		},
	} satisfies AuthenticationChallenger;
}
