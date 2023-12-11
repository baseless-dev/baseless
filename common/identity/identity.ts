import { type AutoId, isAutoId } from "../system/autoid.ts";
import { type IdentityComponent, isIdentityComponent } from "./component.ts";
import {
	InvalidIdentityComponentsError,
	InvalidIdentityError,
	InvalidIdentityMetaError,
	InvalidIDError,
} from "./errors.ts";
export const IDENTITY_AUTOID_PREFIX = "id_";

export interface ID {
	id: AutoId;
	meta: Record<string, unknown>;
}

export interface Identity {
	id: AutoId;
	meta: Record<string, unknown>;
	components: Record<IdentityComponent["id"], IdentityComponent>;
}

export function isID(value: unknown): value is ID {
	return !!value && typeof value === "object" &&
		"id" in value && isAutoId(value.id, IDENTITY_AUTOID_PREFIX) &&
		"meta" in value && typeof value.meta === "object";
}
export function assertID(
	value: unknown,
): asserts value is ID {
	if (!isID(value)) {
		throw new InvalidIDError();
	}
}
export function isIdentityMeta(
	value: unknown,
): value is Identity["meta"] {
	return !!value && typeof value === "object";
}
export function assertIdentityMeta(
	value: unknown,
): asserts value is Identity["meta"] {
	if (!isIdentityMeta(value)) {
		throw new InvalidIdentityMetaError();
	}
}
export function isIdentityComponents(
	value: unknown,
): value is Identity["components"] {
	return !!value && typeof value === "object" &&
		Object.values(value).every(isIdentityComponent);
}
export function assertIdentityComponents(
	value: unknown,
): asserts value is Identity["components"] {
	if (!isIdentityComponents(value)) {
		throw new InvalidIdentityComponentsError();
	}
}
export function isIdentity(value: unknown): value is ID {
	return isID(value) &&
		"components" in value &&
		isIdentityComponents(value.components);
}
export function assertIdentity(
	value: unknown,
): asserts value is ID {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}
