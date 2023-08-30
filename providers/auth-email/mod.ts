import type {
	AuthenticationIdenticator,
	AuthenticationIdenticatorIdentifyOptions,
	AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";
import type { MessageProvider } from "../message.ts";

// deno-lint-ignore explicit-function-return-type
export function EmailAuthentificationIdenticator(
	id: string,
	messageProvider: MessageProvider,
) {
	return {
		kind: "identification",
		id,
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
	} satisfies AuthenticationIdenticator;
}
