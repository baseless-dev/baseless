import { assertOTPOptions, otp, OTPOptions } from "../../lib/otp.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../../lib/authentication/types.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { AuthenticationProvider } from "../auth.ts";

export default class OTPMemoryAuthentificationProvider
	extends AuthenticationProvider {
	#otpOptions: OTPOptions;
	#ttl: number;
	codes: string[] = [];

	constructor(
		id: string,
		options: OTPOptions,
		ttl = 60 * 1000 * 5,
	) {
		super(id);
		assertOTPOptions(options);
		this.#otpOptions = options;
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

	// deno-lint-ignore require-await
	async sendSignInPrompt({ identityId }: {
		locale: string;
		identityId?: Identity["id"];
		identityComponent?: IdentityComponent;
	}): Promise<void> {
		if (identityId) {
			const code = otp(this.#otpOptions);
			this.codes.push(code);
		}
	}

	// deno-lint-ignore require-await
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
		return this.codes.includes(`${value}`);
	}
}
