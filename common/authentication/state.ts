import { AutoId, isAutoId } from "../system/autoid.ts";
import {
	InvalidAuthenticationState,
	InvalidAuthenticationStateAnonymous,
	InvalidAuthenticationStateIdentified,
} from "./errors.ts";

export type AuthenticationStateAnonymous = {
	readonly choices: string[];
};

export type AuthenticationStateIdentified = {
	readonly identity: AutoId;
	readonly choices: string[];
};

export type AuthenticationState =
	| AuthenticationStateAnonymous
	| AuthenticationStateIdentified;

export function isAuthenticationStateAnonymous(
	value?: unknown,
): value is AuthenticationStateAnonymous {
	return typeof value === "object" && value !== null && "choices" in value &&
		Array.isArray(value.choices) &&
		value.choices.every((c) => typeof c === "string");
}

export function assertAuthenticationStateAnonymous(
	value?: unknown,
): asserts value is AuthenticationStateAnonymous {
	if (!isAuthenticationStateAnonymous(value)) {
		throw new InvalidAuthenticationStateAnonymous();
	}
}

export function isAuthenticationStateIdentified(
	value?: unknown,
): value is AuthenticationStateIdentified {
	return isAuthenticationStateAnonymous(value) && "identity" in value &&
		isAutoId(value.identity);
}

export function assertAuthenticationStateIdentified(
	value?: unknown,
): asserts value is AuthenticationStateIdentified {
	if (!isAuthenticationStateIdentified(value)) {
		throw new InvalidAuthenticationStateIdentified();
	}
}

export function isAuthenticationState(
	value?: unknown,
): value is AuthenticationState {
	return isAuthenticationStateAnonymous(value) ||
		isAuthenticationStateIdentified(value);
}

export function assertAuthenticationState(
	value?: unknown,
): asserts value is AuthenticationState {
	if (!isAuthenticationState(value)) {
		throw new InvalidAuthenticationState();
	}
}
