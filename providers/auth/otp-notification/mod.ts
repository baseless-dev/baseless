import { assertOTPOptions, otp, OTPOptions } from "../../../lib/otp.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../../../lib/authentication/types.ts";
import type {
	Identity,
	IdentityComponent,
} from "../../../lib/identity/types.ts";
import { AuthenticationProvider } from "../provider.ts";
import type { IdentityProvider } from "../../identity/provider.ts";
import type { KVProvider } from "../../kv/provider.ts";
import { SendSignInPromptError } from "../../../lib/authentication/errors.ts";
import type { NotificationProvider } from "../../notification/provider.ts";

export default class OTPNotificationAuthentificationProvider
	extends AuthenticationProvider {
	#identification: string;
	#identityProvider: IdentityProvider;
	#notificationProvider: NotificationProvider;
	#kvProvider: KVProvider;
	#otpOptions: OTPOptions;
	#ttl: number;

	constructor(options: {
		id: string;
		identification: string;
		identityProvider: IdentityProvider;
		notificationProvider: NotificationProvider;
		kvProvider: KVProvider;
		options: OTPOptions;
		ttl: number;
	}) {
		super(options.id);
		this.#identification = options.identification;
		this.#identityProvider = options.identityProvider;
		this.#notificationProvider = options.notificationProvider;
		this.#kvProvider = options.kvProvider;
		assertOTPOptions(options.options);
		this.#otpOptions = options.options;
		this.#ttl = options.ttl;
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
			const identity = await this.#identityProvider.get(identityId);
			const identification = identity.components.find((c) =>
				c.id === this.#identification
			)?.identification;
			if (!identification) {
				throw new SendSignInPromptError();
			}
			const code = otp(this.#otpOptions);
			await this.#kvProvider.put(
				["auth-otp-notification", identityId],
				code,
				{
					expiration: this.#ttl,
				},
			);
			await this.#notificationProvider.send(identification, {
				subject: "Your verification code",
				content: {
					"text/x-otp-code": `${code}`,
					"text/plain": `Your verification code is ${code}`,
					"text/html": `Your verification code is <strong>${code}</strong>`,
				},
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
			["auth-otp-notification", identityId],
		);
		return code.value === `${value}`;
	}
}
