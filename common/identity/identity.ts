import { type AutoId, isAutoId } from "../system/autoid.ts";
import { type IdentityChallenge, isIdentityChallenge } from "./challenge.ts";
import {
	InvalidIdentityChallengesError,
	InvalidIdentityError,
	InvalidIdentityIdentificationsError,
	InvalidIdentityMetaError,
	InvalidIDError,
} from "./errors.ts";
import {
	type IdentityIdentification,
	isIdentityIdentification,
} from "./identification.ts";
export const IDENTITY_AUTOID_PREFIX = "id_";

export interface ID {
	id: AutoId;
	meta: Record<string, unknown>;
}

export interface Identity {
	id: AutoId;
	meta: Record<string, unknown>;
	identifications: Record<
		IdentityIdentification["type"],
		IdentityIdentification
	>;
	challenges: Record<IdentityChallenge["type"], IdentityChallenge>;
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
export function isIdentityIdentifications(
	value: unknown,
): value is Identity["identifications"] {
	return !!value && typeof value === "object" &&
		Object.values(value).every(isIdentityIdentification);
}
export function assertIdentityIdentifications(
	value: unknown,
): asserts value is Identity["identifications"] {
	if (!isIdentityIdentifications(value)) {
		throw new InvalidIdentityIdentificationsError();
	}
}
export function isIdentityChallenges(
	value: unknown,
): value is Identity["challenges"] {
	return !!value && typeof value === "object" &&
		Object.values(value).every(isIdentityChallenge);
}
export function assertIdentityChallenges(
	value: unknown,
): asserts value is Identity["challenges"] {
	if (!isIdentityChallenges(value)) {
		throw new InvalidIdentityChallengesError();
	}
}
export function isIdentity(value: unknown): value is ID {
	return isID(value) &&
		"identifications" in value &&
		isIdentityIdentifications(value.identifications) &&
		"challenges" in value && isIdentityChallenges(value.challenges);
}
export function assertIdentity(
	value: unknown,
): asserts value is ID {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}
