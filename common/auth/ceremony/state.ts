import { IDENTITY_AUTOID_PREFIX } from "../../identity/identity.ts";
import { type AutoId, isAutoId } from "../../system/autoid.ts";
import {
	InvalidAuthenticationCeremonyState,
	InvalidAuthenticationCeremonyStateAnonymous,
	InvalidAuthenticationCeremonyStateIdentified,
} from "../errors.ts";

export type AuthenticationCeremonyStateAnonymous = {
	choices: string[];
};
export type AuthenticationCeremonyStateIdentified = {
	identity: AutoId;
	choices: string[];
};
export type AuthenticationCeremonyState =
	| AuthenticationCeremonyStateAnonymous
	| AuthenticationCeremonyStateIdentified;

export function isAuthenticationCeremonyStateAnonymous(
	value: unknown,
): value is AuthenticationCeremonyStateAnonymous {
	return !!value && typeof value === "object" && "choices" in value &&
		Array.isArray(value.choices) &&
		value.choices.every((v) => typeof v === "string");
}
export function isAuthenticationCeremonyStateIdentified(
	value: unknown,
): value is AuthenticationCeremonyStateIdentified {
	return isAuthenticationCeremonyStateAnonymous(value) &&
		"identity" in value && isAutoId(value.identity, IDENTITY_AUTOID_PREFIX);
}
export function isAuthenticationCeremonyState(
	value: unknown,
): value is AuthenticationCeremonyState {
	return isAuthenticationCeremonyStateAnonymous(value) ||
		isAuthenticationCeremonyStateIdentified(value);
}
export function assertAuthenticationCeremonyStateAnonymous(
	value: unknown,
): asserts value is AuthenticationCeremonyStateAnonymous {
	if (!isAuthenticationCeremonyStateAnonymous(value)) {
		throw new InvalidAuthenticationCeremonyStateAnonymous();
	}
}
export function assertAuthenticationCeremonyStateIdentified(
	value: unknown,
): asserts value is AuthenticationCeremonyStateIdentified {
	if (!isAuthenticationCeremonyStateIdentified(value)) {
		throw new InvalidAuthenticationCeremonyStateIdentified();
	}
}
export function assertAuthenticationCeremonyState(
	value: unknown,
): asserts value is AuthenticationCeremonyState {
	if (!isAuthenticationCeremonyState(value)) {
		throw new InvalidAuthenticationCeremonyState();
	}
}
