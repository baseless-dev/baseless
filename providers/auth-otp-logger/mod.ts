import type {
	AuthenticationChallenger,
	AuthenticationChallengerConfigureIdentityChallengeOptions,
	AuthenticationChallengerSendChallengeOptions,
	AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";
import type { IdentityChallenge } from "../../common/identity/challenge.ts";
import {
	createLogger,
	LogLevel,
	LogLevelMethod,
} from "../../common/system/logger.ts";
import {
	assertTOTPOptions,
	totp,
	type TOTPOptions,
} from "../../common/system/otp.ts";

// deno-lint-ignore explicit-function-return-type
export function OTPLoggerAuthentificationChallenger(
	options: Omit<TOTPOptions, "key">,
	logLevel = LogLevel.INFO,
) {
	assertTOTPOptions({ ...options, key: "" });
	const logger = createLogger("auth-otp-logger");
	const logMethod = LogLevelMethod[logLevel];
	return {
		kind: "challenge",
		id: "otp-logger",
		prompt: "otp",
		digits: options.digits ?? 6,
		rateLimit: { count: 0, interval: 0 },
		// deno-lint-ignore require-await
		async configureIdentityChallenge(
			{ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions,
		): Promise<IdentityChallenge["meta"]> {
			return {
				key: challenge,
			};
		},
		async sendChallenge(
			{ identityChallenge }: AuthenticationChallengerSendChallengeOptions,
		): Promise<void> {
			if (
				"key" in identityChallenge.meta &&
				typeof identityChallenge.meta.key === "string"
			) {
				const code = await totp({
					...options,
					key: identityChallenge.meta.key,
					time: Date.now(),
				});
				// TODO template?
				logger[logMethod](code);
			}
		},
		async verify(
			{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions,
		): Promise<boolean> {
			if (
				"key" in identityChallenge.meta &&
				typeof identityChallenge.meta.key === "string"
			) {
				const code = await totp({
					...options,
					key: identityChallenge.meta.key,
					time: Date.now(),
				});
				return code === challenge;
			}
			return false;
		},
	} satisfies AuthenticationChallenger;
}
