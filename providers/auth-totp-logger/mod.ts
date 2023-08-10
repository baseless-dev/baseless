import {
	AuthenticationChallenger,
	type AuthenticationChallengerConfigureIdentityChallengeOptions,
	type AuthenticationChallengerSendChallengeOptions,
	type AuthenticationChallengerVerifyOptions,
} from "../../common/auth/challenger.ts";
import {
	createLogger,
	type Logger,
	LogLevel,
	LogLevelMethod,
} from "../../common/system/logger.ts";
import {
	assertTOTPOptions,
	totp,
	type TOTPOptions,
} from "../../common/system/otp.ts";

export class TOTPLoggerAuthentificationChallenger
	extends AuthenticationChallenger {
	id = "totp";
	prompt = "otp" as const;
	#options: Omit<TOTPOptions, "key">;
	#logger = createLogger("auth-totp-logger");

	#logMethod: keyof Logger;
	constructor(
		options: Omit<TOTPOptions, "key">,
		logLevel = LogLevel.INFO,
	) {
		super();
		assertTOTPOptions({ ...options, key: "" });
		this.#options = options;
		this.#logMethod = LogLevelMethod[logLevel];
	}

	// deno-lint-ignore require-await
	configureIdentityChallenge = async (
		{ challenge }: AuthenticationChallengerConfigureIdentityChallengeOptions,
	) => {
		return {
			key: challenge,
		};
	};

	sendChallenge = async (
		{ identityChallenge }: AuthenticationChallengerSendChallengeOptions,
	): Promise<void> => {
		if (
			"key" in identityChallenge.meta &&
			typeof identityChallenge.meta.key === "string"
		) {
			const code = await totp({
				...this.#options,
				key: identityChallenge.meta.key,
				time: Date.now(),
			});
			// TODO template?
			this.#logger[this.#logMethod](code);
		}
	};

	async verify(
		{ challenge, identityChallenge }: AuthenticationChallengerVerifyOptions,
	): Promise<boolean> {
		if (
			"key" in identityChallenge.meta &&
			typeof identityChallenge.meta.key === "string"
		) {
			const code = await totp({
				...this.#options,
				key: identityChallenge.meta.key,
				time: Date.now(),
			});
			return code === challenge;
		}
		return false;
	}
}
