import { type IContext } from "../../server/context.ts";
import {
	InvalidAuthenticationCeremonyComponentChallengeError,
	InvalidAuthenticationCeremonyComponentChallengeOTPError,
	InvalidAuthenticationCeremonyComponentChallengePasswordError,
	InvalidAuthenticationCeremonyComponentChallengeTOTPError,
	InvalidAuthenticationCeremonyComponentChoiceError,
	InvalidAuthenticationCeremonyComponentConditionalError,
	InvalidAuthenticationCeremonyComponentDoneError,
	InvalidAuthenticationCeremonyComponentError,
	InvalidAuthenticationCeremonyComponentIdentificationEmailError,
	InvalidAuthenticationCeremonyComponentIdentificationError,
	InvalidAuthenticationCeremonyComponentIdentificationOAuth2Error,
	InvalidAuthenticationCeremonyComponentSequenceError,
} from "../errors.ts";
import { type AuthenticationCeremonyState } from "./state.ts";

export interface AuthenticationCeremonyComponentIdentificationEmail {
	readonly kind: "identification";
	readonly id: string;
	readonly prompt: "email";
}
export interface AuthenticationCeremonyComponentIdentificationOAuth2 {
	readonly kind: "identification";
	readonly id: string;
	readonly prompt: "oauth2";
}
export type AuthenticationCeremonyComponentIdentification =
	| AuthenticationCeremonyComponentIdentificationEmail
	| AuthenticationCeremonyComponentIdentificationOAuth2;

export interface AuthenticationCeremonyComponentChallengePassword {
	readonly kind: "challenge";
	readonly id: string;
	readonly prompt: "password";
}

export interface AuthenticationCeremonyComponentChallengeOTP {
	readonly kind: "challenge";
	readonly id: string;
	readonly prompt: "otp";
	readonly timeout?: number;
}

export interface AuthenticationCeremonyComponentChallengeTOTP {
	readonly kind: "challenge";
	readonly id: string;
	readonly prompt: "totp";
	readonly timeout: number;
}

export type AuthenticationCeremonyComponentChallenge =
	| AuthenticationCeremonyComponentChallengePassword
	| AuthenticationCeremonyComponentChallengeOTP
	| AuthenticationCeremonyComponentChallengeTOTP;

export interface AuthenticationCeremonyComponentSequence<
	Component extends AuthenticationCeremonyComponent =
		AuthenticationCeremonyComponent,
> {
	kind: "sequence";
	components: Component[];
}
export interface AuthenticationCeremonyComponentChoice<
	Component extends AuthenticationCeremonyComponent =
		AuthenticationCeremonyComponent,
> {
	kind: "choice";
	components: Component[];
}
export interface AuthenticationCeremonyComponentConditional {
	kind: "conditional";
	condition: (
		context?: IContext,
		state?: AuthenticationCeremonyState,
	) =>
		| AuthenticationCeremonyComponent
		| Promise<AuthenticationCeremonyComponent>;
}
export interface AuthenticationCeremonyComponentDone {
	kind: "done";
}
export type AuthenticationCeremonyComponent =
	| AuthenticationCeremonyComponentIdentification
	| AuthenticationCeremonyComponentChallenge
	| AuthenticationCeremonyComponentSequence<AuthenticationCeremonyComponent>
	| AuthenticationCeremonyComponentChoice<AuthenticationCeremonyComponent>
	| AuthenticationCeremonyComponentConditional
	| AuthenticationCeremonyComponentDone;

export function isAuthenticationCeremonyComponentIdentificationEmail(
	value: unknown,
): value is AuthenticationCeremonyComponentIdentificationEmail {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "identification" && "id" in value &&
		typeof value.id === "string" && "prompt" in value &&
		value.prompt === "email";
}
export function isAuthenticationCeremonyComponentIdentificationOAuth2(
	value: unknown,
): value is AuthenticationCeremonyComponentIdentificationOAuth2 {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "identification" && "id" in value &&
		typeof value.id === "string" && "prompt" in value &&
		value.prompt === "oauth2";
}
export function isAuthenticationCeremonyComponentIdentification(
	value: unknown,
): value is AuthenticationCeremonyComponentIdentification {
	return isAuthenticationCeremonyComponentIdentificationEmail(value) ||
		isAuthenticationCeremonyComponentIdentificationOAuth2(value);
}
export function isAuthenticationCeremonyComponentChallengePassword(
	value: unknown,
): value is AuthenticationCeremonyComponentChallengePassword {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "challenge" && "id" in value &&
		typeof value.id === "string" && "prompt" in value &&
		value.prompt === "password";
}
export function isAuthenticationCeremonyComponentChallengeOTP(
	value: unknown,
): value is AuthenticationCeremonyComponentChallengeOTP {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "challenge" && "id" in value &&
		typeof value.id === "string" && "prompt" in value &&
		value.prompt === "otp" &&
		(!("timeout" in value) || typeof value.timeout === "number");
}
export function isAuthenticationCeremonyComponentChallengeTOTP(
	value: unknown,
): value is AuthenticationCeremonyComponentChallengeOTP {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "challenge" && "id" in value &&
		typeof value.id === "string" && "prompt" in value &&
		value.prompt === "totp" && "timeout" in value &&
		typeof value.timeout === "number";
}
export function isAuthenticationCeremonyComponentChallenge(
	value: unknown,
): value is AuthenticationCeremonyComponentChallenge {
	return isAuthenticationCeremonyComponentChallengePassword(value) ||
		isAuthenticationCeremonyComponentChallengeOTP(value) ||
		isAuthenticationCeremonyComponentChallengeTOTP(value);
}
export function isAuthenticationCeremonyComponentSequence(
	value: unknown,
): value is AuthenticationCeremonyComponentSequence<
	AuthenticationCeremonyComponent
> {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "sequence" && "components" in value &&
		Array.isArray(value.components) &&
		value.components.every(isAuthenticationCeremonyComponent);
}
export function isAuthenticationCeremonyComponentChoice(
	value: unknown,
): value is AuthenticationCeremonyComponentChoice<
	AuthenticationCeremonyComponent
> {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "choice" && "components" in value &&
		Array.isArray(value.components) &&
		value.components.every(isAuthenticationCeremonyComponent);
}
export function isAuthenticationCeremonyComponentConditional(
	value: unknown,
): value is AuthenticationCeremonyComponentConditional {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "conditional" && "condition" in value &&
		typeof value.condition === "function";
}
export function isAuthenticationCeremonyComponentDone(
	value: unknown,
): value is AuthenticationCeremonyComponentDone {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "done";
}
export function isAuthenticationCeremonyComponent(
	value: unknown,
): value is AuthenticationCeremonyComponent {
	return isAuthenticationCeremonyComponentIdentification(value) ||
		isAuthenticationCeremonyComponentChallenge(value) ||
		isAuthenticationCeremonyComponentSequence(value) ||
		isAuthenticationCeremonyComponentChoice(value) ||
		isAuthenticationCeremonyComponentConditional(value) ||
		isAuthenticationCeremonyComponentDone(value);
}
export function assertAuthenticationCeremonyComponentIdentificationEmail(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentIdentificationEmail {
	if (!isAuthenticationCeremonyComponentIdentificationEmail(value)) {
		throw new InvalidAuthenticationCeremonyComponentIdentificationEmailError();
	}
}
export function assertAuthenticationCeremonyComponentIdentificationOAuth2(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentIdentificationOAuth2 {
	if (!isAuthenticationCeremonyComponentIdentificationOAuth2(value)) {
		throw new InvalidAuthenticationCeremonyComponentIdentificationOAuth2Error();
	}
}
export function assertAuthenticationCeremonyComponentIdentification(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentIdentification {
	if (!isAuthenticationCeremonyComponentIdentification(value)) {
		throw new InvalidAuthenticationCeremonyComponentIdentificationError();
	}
}
export function assertAuthenticationCeremonyComponentChallengePassword(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentChallengePassword {
	if (!isAuthenticationCeremonyComponentChallengePassword(value)) {
		throw new InvalidAuthenticationCeremonyComponentChallengePasswordError();
	}
}
export function assertAuthenticationCeremonyComponentChallengeOTP(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentChallengeOTP {
	if (!isAuthenticationCeremonyComponentChallengeOTP(value)) {
		throw new InvalidAuthenticationCeremonyComponentChallengeOTPError();
	}
}
export function assertAuthenticationCeremonyComponentChallengeTOTP(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentChallengeTOTP {
	if (!isAuthenticationCeremonyComponentChallengeTOTP(value)) {
		throw new InvalidAuthenticationCeremonyComponentChallengeTOTPError();
	}
}
export function assertAuthenticationCeremonyComponentChallenge(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentChallenge {
	if (!isAuthenticationCeremonyComponentChallenge(value)) {
		throw new InvalidAuthenticationCeremonyComponentChallengeError();
	}
}
export function assertAuthenticationCeremonyComponentSequence(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentSequence<
	AuthenticationCeremonyComponent
> {
	if (!isAuthenticationCeremonyComponentSequence(value)) {
		throw new InvalidAuthenticationCeremonyComponentSequenceError();
	}
}
export function assertAuthenticationCeremonyComponentChoice(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentChoice<
	AuthenticationCeremonyComponent
> {
	if (!isAuthenticationCeremonyComponentChoice(value)) {
		throw new InvalidAuthenticationCeremonyComponentChoiceError();
	}
}
export function assertAuthenticationCeremonyComponentConditional(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentConditional {
	if (!isAuthenticationCeremonyComponentConditional(value)) {
		throw new InvalidAuthenticationCeremonyComponentConditionalError();
	}
}
export function assertAuthenticationCeremonyComponentDone(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentDone {
	if (!isAuthenticationCeremonyComponentDone(value)) {
		throw new InvalidAuthenticationCeremonyComponentDoneError();
	}
}
export function assertAuthenticationCeremonyComponent(
	value: unknown,
): asserts value is AuthenticationCeremonyComponent {
	if (!isAuthenticationCeremonyComponent(value)) {
		throw new InvalidAuthenticationCeremonyComponentError();
	}
}
