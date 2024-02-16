import { assertOTPOptions, otp, OTPOptions } from "../../lib/otp.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../../lib/authentication/types.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { AuthenticationProvider } from "../auth.ts";
import type { KVProvider } from "../kv.ts";
import type { MessageProvider } from "../message.ts";

export default class OTPMessageAuthentificationProvider
	extends AuthenticationProvider {
	#otpOptions: OTPOptions;
	#ttl: number;
	#kvProvider: KVProvider;
	#messageProvider: MessageProvider;

	constructor(
		id: string,
		options: OTPOptions,
		kvProvider: KVProvider,
		messageProvider: MessageProvider,
		ttl = 60 * 1000 * 5,
	) {
		super(id);
		assertOTPOptions(options);
		this.#otpOptions = options;
		this.#kvProvider = kvProvider;
		this.#messageProvider = messageProvider;
		this.#ttl = ttl;
	}

	configureIdentityComponent(
		_value: unknown,
	): Promise<Omit<IdentityComponent, "id">> {
		return Promise.resolve({ meta: {}, confirmed: true });
	}

	signInPrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "otp",
			options: {
				digits: this.#otpOptions.digits,
				ttl: this.#ttl,
			},
		};
	}

	async sendSignInPrompt({ identityId }: {
		locale: string;
		identityId?: Identity["id"];
		identityComponent?: IdentityComponent;
	}): Promise<void> {
		if (identityId) {
			const code = otp(this.#otpOptions);
			await this.#kvProvider.put(
				["auth-otp-message-signin", identityId],
				code,
				{
					expiration: this.#ttl,
				},
			);
			// TODO template?
			this.#messageProvider.send({
				recipient: identityId,
				text: `${code}`,
			});
		}
	}

	async verifySignInPrompt(
		{ value, identityId }: {
			value: unknown;
			identityId?: Identity["id"];
			identityComponent?: IdentityComponent;
		},
	): Promise<boolean | Identity> {
		if (!identityId) {
			return false;
		}
		const code = await this.#kvProvider.get(
			["auth-otp-message-signin", identityId],
		);
		return code.value === `${value}`;
	}

	setupPrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "email",
			options: {},
		};
	}

	validationPrompt(): undefined | AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "otp",
			options: {
				digits: this.#otpOptions.digits,
				ttl: this.#ttl,
			},
		};
	}

	async sendValidationPrompt({ identity }: {
		locale: string;
		identity: Identity;
	}): Promise<void> {
		const code = otp(this.#otpOptions);
		await this.#kvProvider.put(
			["auth-otp-message-validation", identity.id],
			code,
			{
				expiration: this.#ttl,
			},
		);
		// TODO template?
		this.#messageProvider.send({
			recipient: identity.id,
			text: `${code}`,
		});
	}

	async verifyValidationPrompt({ value, identity }: {
		value: unknown;
		identity: Identity;
	}): Promise<boolean> {
		const code = await this.#kvProvider.get(
			["auth-otp-message-validation", identity.id],
		);
		return code.value === `${value}`;
	}
}
