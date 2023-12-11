import { InvalidIdentityComponentError } from "./errors.ts";

export type IdentityComponent = {
	id: string;
	identification?: string;
	confirmed: boolean;
	meta: Record<string, unknown>;
};

export function isIdentityComponent(
	value: unknown,
): value is IdentityComponent {
	return !!value && typeof value === "object" && "id" in value &&
		typeof value.id === "string" &&
		(!("identification" in value) ||
			typeof value.identification === "string") &&
		"confirmed" in value && typeof value.confirmed === "boolean" &&
		"meta" in value && typeof value.meta === "object";
}
export function assertIdentityComponent(
	value: unknown,
): asserts value is IdentityComponent {
	if (!isIdentityComponent(value)) {
		throw new InvalidIdentityComponentError();
	}
}
