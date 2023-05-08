import type { Context } from "../../../server/context.ts";
import { InvalidAuthenticationConditionalError } from "../errors.ts";
import type { AuthenticationState } from "../state.ts";
import type { AuthenticationStep } from "../step.ts";

export type AuthenticationConditional = {
	readonly type: "conditional";
	readonly condition: (
		context: Context,
		state: AuthenticationState,
	) => AuthenticationStep | Promise<AuthenticationStep>;
};

export function isAuthenticationConditional(
	value?: unknown,
): value is AuthenticationConditional {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && value.type === "conditional" &&
		"condition" in value && typeof value.condition === "function";
}

export function assertAuthenticationConditional(
	value?: unknown,
): asserts value is AuthenticationConditional {
	if (!isAuthenticationConditional(value)) {
		throw new InvalidAuthenticationConditionalError();
	}
}