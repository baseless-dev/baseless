import type { AuthenticationCeremonyComponent } from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationComponent,
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
import type { KVProvider } from "../kv.ts";

export default class OTPLoggerAuthentificationComponent
	extends AuthenticationComponent {
	#kvProvider: KVProvider;
	#options: OTPOptions;
	#ttl: number;
	#logMethod: typeof LogLevelMethod[keyof typeof LogLevelMethod];
	#logger = createLogger("auth-otp-logger");
	constructor(
		id: string,
		kvProvider: KVProvider,
		options: OTPOptions,
		ttl = 60 * 1000,
		logLevel = LogLevel.INFO,
	) {
		super(id);
		this.#kvProvider = kvProvider;
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
	async sendPrompt(
		{ identity }: AuthenticationComponentSendPromptOptions,
	): Promise<void> {
		const code = otp(this.#options);
		await this.#kvProvider.put(["otp-logger", identity.id], code, {
			expiration: this.#ttl,
		});
		// TODO template?
		this.#logger[this.#logMethod](code);
	}
	async verifyPrompt(
		{ identity, value }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (!identity) {
			return false;
		}
		const code = await this.#kvProvider.get(
			["otp-logger", identity.identity.id],
		);
		return code.value === `${value}`;
	}
}
