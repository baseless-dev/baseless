import { type IContext } from "../../server/context.ts";
import {
	InvalidAuthenticationCeremonyComponentChallengeError,
	InvalidAuthenticationCeremonyComponentChoiceError,
	InvalidAuthenticationCeremonyComponentConditionalError,
	InvalidAuthenticationCeremonyComponentDoneError,
	InvalidAuthenticationCeremonyComponentError,
	InvalidAuthenticationCeremonyComponentIdentificationError,
	InvalidAuthenticationCeremonyComponentSequenceError,
} from "../errors.ts";
import { type AuthenticationCeremonyState } from "./state.ts";

export interface AuthenticationCeremonyComponentIdentification {
	kind: "identification";
	id: string;
	prompt: "email" | "action";
}
export interface AuthenticationCeremonyComponentChallenge {
	kind: "challenge";
	id: string;
	prompt: "password" | "otp";
}
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

export function isAuthenticationCeremonyComponentIdentification(
	value: unknown,
): value is AuthenticationCeremonyComponentIdentification {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "identification" && "id" in value &&
		typeof value.id === "string" && "prompt" in value &&
		(value.prompt === "email" || value.prompt === "action");
}
export function isAuthenticationCeremonyComponentChallenge(
	value: unknown,
): value is AuthenticationCeremonyComponentChallenge {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "challenge" && "id" in value &&
		typeof value.id === "string" && "prompt" in value &&
		(value.prompt === "password" || value.prompt === "otp");
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
export function assertAuthenticationCeremonyComponentIdentification(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentIdentification {
	if (!isAuthenticationCeremonyComponentIdentification(value)) {
		throw new InvalidAuthenticationCeremonyComponentIdentificationError();
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
