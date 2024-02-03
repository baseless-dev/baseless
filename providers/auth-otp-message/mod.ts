import type { AuthenticationCeremonyComponentPrompt } from "../../lib/authentication/types.ts";
import type { Identity } from "../../lib/identity/types.ts";
import { createLogger, LogLevel, LogLevelMethod } from "../../lib/logger.ts";
import { assertOTPOptions, otp, type OTPOptions } from "../../lib/otp.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentSendPromptOptions,
	AuthenticationComponentSendValidationOptions,
	AuthenticationComponentValidateCodeOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../auth_component.ts";
import type { KVProvider } from "../kv.ts";
import type { MessageProvider } from "../message.ts";

export default class OTPMessageAuthentificationComponent
	extends AuthenticationComponent {
	prompt = "otp" as const;
	options: { digits: number; timeout: number };
	#kvProvider: KVProvider;
	#messageProvider: MessageProvider;
	#options: OTPOptions;
	#ttl: number;
	constructor(
		id: string,
		kvProvider: KVProvider,
		messageProvider: MessageProvider,
		options: OTPOptions,
		ttl = 60 * 1000 * 5,
	) {
		super(id);
		this.#kvProvider = kvProvider;
		this.#messageProvider = messageProvider;
		assertOTPOptions(options);
		this.#options = options;
		this.#ttl = ttl;
		this.options = {
			digits: this.#options.digits ?? 6,
			timeout: this.#ttl,
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
		this.#messageProvider.send({
			recipient: identity.id,
			text: `${code}`,
		});
	}
	async verifyPrompt(
		{ identity, value }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (!identity) {
			return false;
		}
		const code = await this.#kvProvider.get(
			["otp-logger", identity.id],
		);
		return code.value === `${value}`;
	}
	sendValidationCode(
		{}: AuthenticationComponentSendValidationOptions,
	): Promise<void> {
		debugger;
		throw "TODO!";
	}
	validateCode(
		options: AuthenticationComponentValidateCodeOptions,
	): Promise<boolean> {
		debugger;
		throw "TODO!";
	}
	validationCodePrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: "validation",
			kind: "prompt",
			prompt: "otp",
			options: {
				...this.options,
			},
		};
	}
}
