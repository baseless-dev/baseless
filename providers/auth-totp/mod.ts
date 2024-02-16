import { assertTOTPOptions, totp, type TOTPOptions } from "../../lib/otp.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../../lib/authentication/types.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { AuthenticationProvider } from "../auth.ts";

export default class TOTPAuthentificationProvider
	extends AuthenticationProvider {
	#totpOptions: Omit<TOTPOptions, "key">;

	constructor(
		id: string,
		options: Omit<TOTPOptions, "key">,
	) {
		super(id);
		assertTOTPOptions({ ...options, key: "" });
		this.#totpOptions = options;
	}

	async configureIdentityComponent(
		value: unknown,
	): Promise<Omit<IdentityComponent, "id">> {
		try {
			const _ = await totp({
				digits: this.#totpOptions.digits,
				period: this.#totpOptions.period,
				key: `${value}`,
				time: Date.now(),
			});
		} catch (_error) {
			throw new Error("Invalid TOTP key");
		}
		return { meta: { key: `${value}` }, confirmed: true };
	}

	signInPrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "totp",
			options: {
				digits: this.#totpOptions.digits,
				period: this.#totpOptions.period,
			},
		};
	}

	async verifySignInPrompt(
		{ value, identityComponent }: {
			value: unknown;
			identityId?: Identity["id"];
			identityComponent?: IdentityComponent;
		},
	): Promise<boolean | Identity> {
		if (!identityComponent) {
			return false;
		}
		if (
			"key" in identityComponent.meta &&
			typeof identityComponent.meta.key === "string"
		) {
			const half = this.#totpOptions.period / 2;
			for (const offset of [-half, 0, half]) {
				const code = await totp({
					...this.#totpOptions,
					key: identityComponent.meta.key,
					time: Date.now() / 1000 + offset,
				});
				if (code === `${value}`) {
					return true;
				}
			}
			return false;
		}
		return false;
	}
}
