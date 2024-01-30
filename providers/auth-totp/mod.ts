import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { assertTOTPOptions, totp, type TOTPOptions } from "../../lib/otp.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../auth_component.ts";

export default class TOTPAuthentificationComponent
	extends AuthenticationComponent {
	prompt = "totp" as const;
	options: { digits: number; timeout: number };
	#totpOptions: Omit<TOTPOptions, "key">;
	constructor(id: string, options: Omit<TOTPOptions, "key">) {
		super(id);
		assertTOTPOptions({ ...options, key: "" });
		this.#totpOptions = options;
		this.options = {
			digits: options.digits ?? 6,
			timeout: options.period ?? 60,
		};
	}
	async getIdentityComponentMeta(
		{ value }: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Pick<IdentityComponent, "identification" | "meta">> {
		try {
			const _ = await totp({
				digits: this.options.digits,
				period: this.options.timeout,
				key: `${value}`,
				time: Date.now(),
			});
		} catch (_error) {
			throw new Error("Invalid TOTP key");
		}
		return { meta: { key: `${value}` } };
	}
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
			const half = this.options.timeout / 2;
			for (const offset of [-half, 0, half]) {
				const code = await totp({
					...this.#totpOptions,
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
