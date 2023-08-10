import { IDENTITY_AUTOID_PREFIX } from "../../identity/identity.ts";
import { type AutoId, isAutoId } from "../../system/autoid.ts";
import {
	InvalidAuthenticationCeremonyResponseDoneError,
	InvalidAuthenticationCeremonyResponseEncryptedStateError,
	InvalidAuthenticationCeremonyResponseError,
	InvalidAuthenticationCeremonyResponseErrorError,
	InvalidAuthenticationCeremonyResponseStateError,
	InvalidAuthenticationCeremonyResponseTokensError,
} from "../errors.ts";
import {
	type AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "./ceremony.ts";
import {
	type AuthenticationCeremonyState,
	isAuthenticationCeremonyState,
} from "./state.ts";

export type AuthenticationCeremonyResponseDone = {
	done: true;
	identityId: AutoId;
};
export type AuthenticationCeremonyResponseTokens = {
	done: true;
	access_token: string;
	id_token: string;
	refresh_token?: string;
};
export type AuthenticationCeremonyResponseError = {
	done: false;
	error: true;
};
export type AuthenticationCeremonyResponseState<
	Component extends AuthenticationCeremonyComponent =
		AuthenticationCeremonyComponent,
> = {
	state: AuthenticationCeremonyState;
	done: false;
	component: Component;
	first: boolean;
	last: boolean;
};
export type AuthenticationCeremonyResponseEncryptedState<
	Component extends AuthenticationCeremonyComponent =
		AuthenticationCeremonyComponent,
> = {
	encryptedState: string;
	done: false;
	component: Component;
	first: boolean;
	last: boolean;
};
export type AuthenticationCeremonyResponse<
	Component extends AuthenticationCeremonyComponent =
		AuthenticationCeremonyComponent,
> =
	| AuthenticationCeremonyResponseDone
	| AuthenticationCeremonyResponseTokens
	| AuthenticationCeremonyResponseError
	| AuthenticationCeremonyResponseState<Component>
	| AuthenticationCeremonyResponseEncryptedState<Component>;

export function isAuthenticationCeremonyResponseDone(
	value: unknown,
): value is AuthenticationCeremonyResponseDone {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && "identityId" in value &&
		typeof value.identityId === "string" &&
		isAutoId(value.identityId, IDENTITY_AUTOID_PREFIX);
}
export function isAuthenticationCeremonyResponseTokens(
	value: unknown,
): value is AuthenticationCeremonyResponseTokens {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && "access_token" in value &&
		typeof value.access_token === "string" && "id_token" in value &&
		typeof value.id_token === "string" &&
		(!("refresh_token" in value) || typeof value.refresh_token === "string");
}
export function isAuthenticationCeremonyResponseError(
	value: unknown,
): value is AuthenticationCeremonyResponseError {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "error" in value && value.error === true;
}
export function isAuthenticationCeremonyResponseState(
	value: unknown,
): value is AuthenticationCeremonyResponseState {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "state" in value &&
		isAuthenticationCeremonyState(value.state) && "component" in value &&
		isAuthenticationCeremonyComponent(value.component) &&
		"first" in value && typeof value.first === "boolean" && "last" in value &&
		typeof value.last === "boolean";
}
export function isAuthenticationCeremonyResponseEncryptedState(
	value: unknown,
): value is AuthenticationCeremonyResponseEncryptedState {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "encryptedState" in value &&
		typeof value.encryptedState === "string" && "component" in value &&
		isAuthenticationCeremonyComponent(value.component) &&
		"first" in value && typeof value.first === "boolean" && "last" in value &&
		typeof value.last === "boolean";
}
export function isAuthenticationCeremonyResponse(
	value: unknown,
): value is AuthenticationCeremonyResponse {
	return isAuthenticationCeremonyResponseDone(value) ||
		isAuthenticationCeremonyResponseTokens(value) ||
		isAuthenticationCeremonyResponseError(value) ||
		isAuthenticationCeremonyResponseState(value) ||
		isAuthenticationCeremonyResponseEncryptedState(value);
}
export function assertAuthenticationCeremonyResponseDone(
	value: unknown,
): asserts value is AuthenticationCeremonyResponseDone {
	if (!isAuthenticationCeremonyResponseDone(value)) {
		throw new InvalidAuthenticationCeremonyResponseDoneError();
	}
}
export function assertAuthenticationCeremonyResponseTokens(
	value: unknown,
): asserts value is AuthenticationCeremonyResponseTokens {
	if (!isAuthenticationCeremonyResponseTokens(value)) {
		throw new InvalidAuthenticationCeremonyResponseTokensError();
	}
}
export function assertAuthenticationCeremonyResponseError(
	value: unknown,
): asserts value is AuthenticationCeremonyResponseError {
	if (!isAuthenticationCeremonyResponseError(value)) {
		throw new InvalidAuthenticationCeremonyResponseErrorError();
	}
}
export function assertAuthenticationCeremonyResponseState(
	value: unknown,
): asserts value is AuthenticationCeremonyResponseState {
	if (!isAuthenticationCeremonyResponseState(value)) {
		throw new InvalidAuthenticationCeremonyResponseStateError();
	}
}
export function assertAuthenticationCeremonyResponseEncryptedState(
	value: unknown,
): asserts value is AuthenticationCeremonyResponseEncryptedState {
	if (!isAuthenticationCeremonyResponseEncryptedState(value)) {
		throw new InvalidAuthenticationCeremonyResponseEncryptedStateError();
	}
}
export function assertAuthenticationCeremonyResponse(
	value: unknown,
): asserts value is AuthenticationCeremonyResponse {
	if (!isAuthenticationCeremonyResponse(value)) {
		throw new InvalidAuthenticationCeremonyResponseError();
	}
}
