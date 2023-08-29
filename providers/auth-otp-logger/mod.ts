import type {
	AuthenticationChallenger,
	AuthenticationChallengerSendChallengeOptions,
	AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";
import {
	createLogger,
	LogLevel,
	LogLevelMethod,
} from "../../common/system/logger.ts";
import {
	assertOTPOptions,
	otp,
	type OTPOptions,
} from "../../common/system/otp.ts";

// deno-lint-ignore explicit-function-return-type
export function OTPLoggerAuthentificationChallenger(
	options: OTPOptions,
	ttl = 60 * 1000,
	logLevel = LogLevel.INFO,
) {
	assertOTPOptions(options);
	const logger = createLogger("auth-otp-logger");
	const logMethod = LogLevelMethod[logLevel];
	return {
		kind: "challenge",
		id: "otp-logger",
		prompt: "otp",
		digits: options.digits ?? 6,
		rateLimit: { count: 0, interval: 0 },
		async sendChallenge(
			{ identityChallenge, context }:
				AuthenticationChallengerSendChallengeOptions,
		): Promise<void> {
			const code = otp(options);
			await context.kv.put(`otp-logger/${identityChallenge.identityId}`, code, {
				expiration: ttl,
			});
			// TODO template?
			logger[logMethod](code);
		},
		async verify(
			{ challenge, identityChallenge, context }:
				AuthenticationChallengerVerifyOptions,
		): Promise<boolean> {
			const code = await context.kv.get(
				`otp-logger/${identityChallenge.identityId}`,
			);
			return code.value === challenge;
		},
	} satisfies AuthenticationChallenger;
}
