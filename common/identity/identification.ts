import { InvalidIdentityIdentificationError } from "./errors.ts";

export type IdentityIdentification = {
	type: string;
	identification: string;
	confirmed: boolean;
	meta: Record<string, unknown>;
};

export function isIdentityIdentification(
	value: unknown,
): value is IdentityIdentification {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && "identification" in value &&
		typeof value.identification === "string" && "confirmed" in value &&
		typeof value.confirmed === "boolean" && "meta" in value &&
		typeof value.meta === "object";
}
export function assertIdentityIdentification(
	value: unknown,
): asserts value is IdentityIdentification {
	if (!isIdentityIdentification(value)) {
		throw new InvalidIdentityIdentificationError();
	}
}
