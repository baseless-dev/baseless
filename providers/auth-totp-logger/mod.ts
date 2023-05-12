import { AuthenticationChallenger } from "../../common/auth/challenger.ts";
import { IdentityChallenge } from "../../common/identity/challenge.ts";
import {
	assertTOTPOptions,
	totp,
	TOTPOptions,
} from "../../common/system/otp.ts";
import { MessageProvider } from "../message.ts";

export class TOTPLoggerAuthentificationChallenger
	extends AuthenticationChallenger {
	#options: Omit<TOTPOptions, "key">;
	#messageProvider: MessageProvider;
	constructor(
		options: Omit<TOTPOptions, "key">,
		messageProvider: MessageProvider,
	) {
		super();
		assertTOTPOptions({ ...options, key: "" });
		this.#options = options;
		this.#messageProvider = messageProvider;
	}

	// deno-lint-ignore require-await
	async configureMeta(challenge: string): Promise<Record<string, unknown>> {
		return {
			key: challenge,
		};
	}

	sendChallenge = async (
		identityChallenge: IdentityChallenge,
	): Promise<void> => {
		if (
			"key" in identityChallenge.meta &&
			typeof identityChallenge.meta.key === "string"
		) {
			const code = await totp({
				...this.#options,
				key: identityChallenge.meta.key,
				time: Date.now(),
			});
			await this.#messageProvider.send({
				recipient: identityChallenge.identityId,
				subject: "TOTP Authentication",
				text: code,
			});
		}
	};

	async verify(
		identityChallenge: IdentityChallenge,
		challenge: string,
	): Promise<boolean> {
		if (
			"key" in identityChallenge.meta &&
			typeof identityChallenge.meta.key === "string"
		) {
			const code = await totp({
				...this.#options,
				key: identityChallenge.meta.key,
				time: Date.now(),
			});
			return code === challenge;
		}
		return false;
	}
}
