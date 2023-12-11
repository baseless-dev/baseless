import type { AuthenticationCeremonyComponent } from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentSendPromptOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../../common/auth/component.ts";
import type { Identity } from "../../common/identity/identity.ts";
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

export default class OTPLoggerAuthentificationComponent
	extends AuthenticationComponent {
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
	getCeremonyComponent(): AuthenticationCeremonyComponent {
		return {
			kind: "prompt",
			id: this.id,
			prompt: "otp",
			options: {
				digits: this.#options.digits ?? 6,
				timeout: this.#ttl,
			},
		};
	}
	// deno-lint-ignore require-await
	async getIdentityComponentMeta(
		_options: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Record<string, unknown>> {
		return {};
	}
	async sendPrompt(
		{ context, identity }: AuthenticationComponentSendPromptOptions,
	): Promise<void> {
		const code = otp(this.#options);
		await context.kv.put(["otp-logger", identity.id], code, {
			expiration: this.#ttl,
		});
		// TODO template?
		this.#logger[this.#logMethod](code);
	}
	async verifyPrompt(
		{ context, identity, value }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (!identity) {
			return false;
		}
		const code = await context.kv.get(
			["otp-logger", identity.identity.id],
		);
		return code.value === `${value}`;
	}
}
