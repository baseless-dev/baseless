import type { AuthenticationCeremonyComponentChallenge } from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationChallenger,
	type AuthenticationChallengerConfigureIdentityChallengeOptions,
	type AuthenticationChallengerSendChallengeOptions,
	type AuthenticationChallengerVerifyOptions,
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

export default class OTPLoggerAuthentificationChallenger
	extends AuthenticationChallenger {
	#options: OTPOptions;
	#ttl: number;
	#logMethod: typeof LogLevelMethod[keyof typeof LogLevelMethod];
	#logger = createLogger("auth-otp-logger");
	constructor(
		id: string,
		options: OTPOptions,
		ttl = 60 * 1000,
		logLevel = LogLevel.INFO,
	) {
		super(id);
		assertOTPOptions(options);
		this.#options = options;
		this.#ttl = ttl;
		this.#logMethod = LogLevelMethod[logLevel];
	}
	ceremonyComponent(): AuthenticationCeremonyComponentChallenge {
		return {
			id: this.id,
			kind: "challenge",
			prompt: "otp",
			digits: this.#options.digits ?? 6,
			timeout: this.#ttl,
		};
	}
	// deno-lint-ignore require-await
	async configureIdentityChallenge(
		_options: AuthenticationChallengerConfigureIdentityChallengeOptions,
	): Promise<Record<string, unknown>> {
		return {};
	}
	async sendChallenge(
		{ identityId, context }: AuthenticationChallengerSendChallengeOptions,
	): Promise<void> {
		const code = otp(this.#options);
		await context.kv.put(["otp-logger", identityId], code, {
			expiration: this.#ttl,
		});
		// TODO template?
		this.#logger[this.#logMethod](code);
	}
	async verify(
		{ challenge, identityId, context }: AuthenticationChallengerVerifyOptions,
	): Promise<boolean> {
		const code = await context.kv.get(
			["otp-logger", identityId],
		);
		return code.value === `${challenge}`;
	}
}
