import type {
	AuthenticationIdenticator,
	AuthenticationIdenticatorIdentifyOptions,
	AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";
import type { MessageProvider } from "../message.ts";

export function EmailAuthentificationIdenticator(
	messageProvider: MessageProvider,
): AuthenticationIdenticator {
	return {
		kind: "identification",
		id: "email",
		prompt: "email",
		rateLimit: { count: 0, interval: 0 },
		async sendMessage(
			{ message, identityIdentification }:
				AuthenticationIdenticatorSendMessageOptions,
		): Promise<void> {
			await messageProvider.send({
				recipient: identityIdentification.identification,
				...message,
			});
		},
		// deno-lint-ignore require-await
		async identify(
			{ identityIdentification, identification }:
				AuthenticationIdenticatorIdentifyOptions,
		): Promise<boolean> {
			return identityIdentification.identification === identification;
		},
	};
}
