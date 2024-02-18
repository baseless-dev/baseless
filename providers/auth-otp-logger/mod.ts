import { assertOTPOptions, otp, OTPOptions } from "../../lib/otp.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../../lib/authentication/types.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { AuthenticationProvider } from "../auth.ts";
import type { KVProvider } from "../kv.ts";
import { createLogger } from "../../lib/logger.ts";

export default class OTPLoggerAuthentificationProvider
	extends AuthenticationProvider {
	#otpOptions: OTPOptions;
	#ttl: number;
	#kvProvider: KVProvider;
	#logger = createLogger("auth-otp-logger");

	constructor(
		id: string,
		options: OTPOptions,
		kvProvider: KVProvider,
		ttl = 60 * 1000 * 5,
	) {
		super(id);
		assertOTPOptions(options);
		this.#otpOptions = options;
		this.#kvProvider = kvProvider;
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
			this.#logger.info(`Code: ${code}`);
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
}
