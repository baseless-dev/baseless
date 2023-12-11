import type { AuthenticationCeremonyComponent } from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentSendPromptOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../../common/auth/component.ts";
import type { Identity } from "../../common/identity/identity.ts";
import {
	assertTOTPOptions,
	totp,
	type TOTPOptions,
} from "../../common/system/otp.ts";

export default class TOTPAuthenticationComponent
	extends AuthenticationComponent {
	#options: Omit<TOTPOptions, "key">;
	constructor(id: string, options: Omit<TOTPOptions, "key">) {
		super(id);
		assertTOTPOptions({ ...options, key: "" });
		this.#options = options;
	}
	getCeremonyComponent(): AuthenticationCeremonyComponent {
		return {
			kind: "prompt",
			id: this.id,
			prompt: "totp",
			options: {
				digits: 6,
				timeout: 60,
			},
		};
	}
	async getIdentityComponentMeta(
		{ value }: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Record<string, unknown>> {
		try {
			const _ = await totp({
				digits: 6,
				period: 60,
				key: `${value}`,
				time: Date.now(),
			});
		} catch (_error) {
			throw new Error("Invalid TOTP key");
		}
		return { key: `${value}` };
	}
	async sendPrompt(
		_options: AuthenticationComponentSendPromptOptions,
	): Promise<void> {}
	async verifyPrompt(
		{ value, identity }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (!identity) {
			return false;
		}
		if (
			"key" in identity.component.meta &&
			typeof identity.component.meta.key === "string"
		) {
			for (const offset of [-30, 0, 30]) {
				const code = await totp({
					...this.#options,
					key: identity.component.meta.key,
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
