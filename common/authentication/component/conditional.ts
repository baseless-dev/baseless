import type { Context } from "../../../server/context.ts";
import { InvalidAuthenticationCeremonyComponentConditionalError } from "../errors.ts";
import type { AuthenticationCeremonyState } from "../state.ts";
import type { AuthenticationCeremonyComponent } from "../ceremony.ts";

export type AuthenticationCeremonyComponentConditional = {
	readonly type: "conditional";
	readonly condition: (
		context: Context,
		state: AuthenticationCeremonyState,
	) =>
		| AuthenticationCeremonyComponent
		| Promise<AuthenticationCeremonyComponent>;
};

export function isAuthenticationCeremonyComponentConditional(
	value?: unknown,
): value is AuthenticationCeremonyComponentConditional {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && value.type === "conditional" &&
		"condition" in value && typeof value.condition === "function";
}

export function assertAuthenticationCeremonyComponentConditional(
	value?: unknown,
): asserts value is AuthenticationCeremonyComponentConditional {
	if (!isAuthenticationCeremonyComponentConditional(value)) {
		throw new InvalidAuthenticationCeremonyComponentConditionalError();
	}
}
