import type { IdentityIdentification } from "../identity/identification.ts";
import type { Message } from "../message/message.ts";
import type { IContext } from "../server/context.ts";
import type { AutoId } from "../system/autoid.ts";
import {
	type AuthenticationCeremonyComponentIdentification,
	isAuthenticationCeremonyComponentIdentification,
} from "./ceremony/ceremony.ts";
import { InvalidAuthenticationIdenticatorError } from "./errors.ts";

export type AuthenticationIdenticatorIdentifyOptions = {
	context: IContext;
	identityId: AutoId;
	identityIdentification: IdentityIdentification;
	identification: string;
};

export type AuthenticationIdenticatorSendMessageOptions = {
	context: IContext;
	identityId: AutoId;
	identityIdentification: IdentityIdentification;
	message: Omit<Message, "recipient">;
};

export type AuthenticationIdenticator =
	& AuthenticationCeremonyComponentIdentification
	& {
		identify(
			options: AuthenticationIdenticatorIdentifyOptions,
		): Promise<boolean | URL>;
		sendMessage?: (
			options: AuthenticationIdenticatorSendMessageOptions,
		) => Promise<void>;
		rateLimit: { interval: number; count: number };
	};

export function isAuthenticationIdenticator(
	value: unknown,
): value is AuthenticationIdenticator {
	return isAuthenticationCeremonyComponentIdentification(value) &&
		"identify" in value && typeof value.identify === "function" &&
		"rateLimit" in value && typeof value.rateLimit === "object" &&
		!!value.rateLimit && "interval" in value.rateLimit &&
		typeof value.rateLimit.interval === "number" &&
		"count" in value.rateLimit && typeof value.rateLimit.count === "number" &&
		(!("sendMessage" in value) ||
			typeof value.sendMessage === "function");
}
export function assertAuthenticationIdenticator(
	value: unknown,
): asserts value is AuthenticationIdenticator {
	if (!isAuthenticationIdenticator(value)) {
		throw new InvalidAuthenticationIdenticatorError();
	}
}
