import { InvalidAuthenticationCeremonyComponentConditionalError } from "../../errors.ts";
import type { AuthenticationCeremonyState } from "../state.ts";
import type { AuthenticationCeremonyComponent } from "../ceremony.ts";
import type { Context } from "../../../server/context.ts";

export type AuthenticationCeremonyComponentConditional = {
	readonly kind: "conditional";
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
	return !!value && typeof value === "object" && "kind" in value &&
		typeof value.kind === "string" && value.kind === "conditional" &&
		"condition" in value && typeof value.condition === "function";
}

export function assertAuthenticationCeremonyComponentConditional(
	value?: unknown,
): asserts value is AuthenticationCeremonyComponentConditional {
	if (!isAuthenticationCeremonyComponentConditional(value)) {
		throw new InvalidAuthenticationCeremonyComponentConditionalError();
	}
}
