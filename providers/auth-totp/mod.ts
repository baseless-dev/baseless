import {
	AuthenticationChallenger,
	type AuthenticationChallengerConfigureIdentityChallengeOptions,
	type AuthenticationChallengerSendChallengeOptions,
	type AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";
import type { IdentityChallenge } from "../../common/identity/challenge.ts";
import {
	assertTOTPOptions,
	totp,
	type TOTPOptions,
} from "../../common/system/otp.ts";

export default class TOTPAuthenticationChallenger
	extends AuthenticationChallenger {
	#options: Omit<TOTPOptions, "key">;
	constructor(options: Omit<TOTPOptions, "key">) {
		super();
		assertTOTPOptions({ ...options, key: "" });
		this.#options = options;
	}
	async configureIdentityChallenge(
		{ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions,
	): Promise<Record<string, unknown>> {
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
	}
	async sendChallenge(
		_options: AuthenticationChallengerSendChallengeOptions,
	): Promise<void> {}
	async verify(
		{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions,
	): Promise<boolean> {
		if (
			"key" in identityChallenge.meta &&
			typeof identityChallenge.meta.key === "string"
		) {
			for (const offset of [-30, 0, 30]) {
				const code = await totp({
					...this.#options,
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
	}
}
