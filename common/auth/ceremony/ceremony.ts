import type { IContext } from "../../server/context.ts";
import {
	InvalidAuthenticationCeremonyComponentChoiceError,
	InvalidAuthenticationCeremonyComponentConditionalError,
	InvalidAuthenticationCeremonyComponentDoneError,
	InvalidAuthenticationCeremonyComponentError,
	InvalidAuthenticationCeremonyComponentPromptError,
	InvalidAuthenticationCeremonyComponentSequenceError,
} from "../errors.ts";
import type { AuthenticationCeremonyState } from "./state.ts";

export interface AuthenticationCeremonyComponentPrompt {
	readonly kind: "prompt";
	readonly id: string;
	readonly prompt: "email" | "oauth2" | "password" | "otp" | "totp";
	readonly options: Record<string, unknown>;
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
	components: AuthenticationCeremonyComponent[];
	condition: (
		context?: IContext,
		state?: AuthenticationCeremonyState,
	) =>
		| number
		| Promise<number>;
}
export interface AuthenticationCeremonyComponentDone {
	kind: "done";
}
export type AuthenticationCeremonyComponent =
	| AuthenticationCeremonyComponentPrompt
	| AuthenticationCeremonyComponentSequence<AuthenticationCeremonyComponent>
	| AuthenticationCeremonyComponentChoice<AuthenticationCeremonyComponent>
	| AuthenticationCeremonyComponentConditional
	| AuthenticationCeremonyComponentDone;

export function isAuthenticationCeremonyComponentPrompt(
	value: unknown,
): value is AuthenticationCeremonyComponentPrompt {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "prompt" && "id" in value &&
		typeof value.id === "string" && "options" in value &&
		typeof value.options === "object";
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
		value.kind === "conditional" && "components" in value &&
		Array.isArray(value.components) &&
		value.components.every(isAuthenticationCeremonyComponent) &&
		"condition" in value && typeof value.condition === "function";
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
	return isAuthenticationCeremonyComponentPrompt(value) ||
		isAuthenticationCeremonyComponentSequence(value) ||
		isAuthenticationCeremonyComponentChoice(value) ||
		isAuthenticationCeremonyComponentConditional(value) ||
		isAuthenticationCeremonyComponentDone(value);
}
export function assertAuthenticationCeremonyComponentPrompt(
	value: unknown,
): asserts value is AuthenticationCeremonyComponentPrompt {
	if (!isAuthenticationCeremonyComponentPrompt(value)) {
		throw new InvalidAuthenticationCeremonyComponentPromptError();
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
