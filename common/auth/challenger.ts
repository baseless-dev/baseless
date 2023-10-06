import type { IdentityChallenge } from "../identity/challenge.ts";
import type { IContext } from "../server/context.ts";
import type { AutoId } from "../system/autoid.ts";
import {
	type AuthenticationCeremonyComponentChallenge,
	isAuthenticationCeremonyComponentChallenge,
} from "./ceremony/ceremony.ts";
import { InvalidAuthenticationChallengerError } from "./errors.ts";

export type AuthenticationChallengerConfigureIdentityChallengeOptions = {
	context: IContext;
	challenge: string;
};

export type AuthenticationChallengerSendChallengeOptions = {
	context: IContext;
	locale: string;
	identityId: AutoId;
	identityChallenge: IdentityChallenge;
};

export type AuthenticationChallengerVerifyOptions = {
	context: IContext;
	identityId: AutoId;
	identityChallenge: IdentityChallenge;
	challenge: string;
};

export type AuthenticationChallenger =
	& AuthenticationCeremonyComponentChallenge
	& {
		configureIdentityChallenge?: (
			options: AuthenticationChallengerConfigureIdentityChallengeOptions,
		) => Promise<IdentityChallenge["meta"]>;
		sendChallenge?: (
			options: AuthenticationChallengerSendChallengeOptions,
		) => Promise<void>;
		rateLimit: { interval: number; count: number };
		verify(
			options: AuthenticationChallengerVerifyOptions,
		): Promise<boolean>;
	};

export function isAuthenticationChallenger(
	value: unknown,
): value is AuthenticationChallenger {
	return isAuthenticationCeremonyComponentChallenge(value) &&
		"verify" in value && typeof value.verify === "function" &&
		"rateLimit" in value && typeof value.rateLimit === "object" &&
		!!value.rateLimit && "interval" in value.rateLimit &&
		typeof value.rateLimit.interval === "number" &&
		"count" in value.rateLimit && typeof value.rateLimit.count === "number" &&
		(!("sendChallenge" in value) ||
			typeof value.sendChallenge === "function") &&
		(!("configureIdentityChallenge" in value) ||
			typeof value.configureIdentityChallenge === "function");
}
export function assertAuthenticationChallenger(
	value: unknown,
): asserts value is AuthenticationChallenger {
	if (!isAuthenticationChallenger(value)) {
		throw new InvalidAuthenticationChallengerError();
	}
}
