import { AutoId, isAutoId } from "../../shared/autoid.ts";

export interface Identity<Meta = Record<string, unknown>> {
	readonly id: AutoId;
	readonly meta: Meta;
}

export interface IdentityIdentification<Meta = Record<string, unknown>> {
	readonly identityId: AutoId;
	readonly type: string;
	readonly identification: string;
	readonly verified: boolean;
	readonly meta: Meta;
}

export interface IdentityChallenge<Meta = Record<string, unknown>> {
	readonly identityId: AutoId;
	readonly type: string;
	readonly challenge: string;
	readonly meta: Meta;
}

export function isIdentity(value?: unknown): value is Identity {
	return !!value && typeof value === "object" && "id" in value &&
		"meta" in value && isAutoId(value.id) && typeof value.meta === "object";
}

export function assertIdentity(value?: unknown): asserts value is Identity {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}

export function isIdentityIdentification(
	value?: unknown,
): value is IdentityIdentification {
	return !!value && typeof value === "object" && "identityId" in value &&
		"type" in value && "identification" in value && "verified" in value &&
		"meta" in value && isAutoId(value.identityId) &&
		typeof value.verified === "boolean" && typeof value.meta === "object";
}

export function assertIdentityIdentification(
	value?: unknown,
): asserts value is IdentityIdentification {
	if (!isIdentityIdentification(value)) {
		throw new InvalidIdentityError();
	}
}

export function isIdentityChallenge(
	value?: unknown,
): value is IdentityChallenge {
	return !!value && typeof value === "object" && "identityId" in value &&
		"type" in value && "challenge" in value && "meta" in value &&
		isAutoId(value.identityId) && typeof value.meta === "object";
}

export function assertIdentityChallenge(
	value?: unknown,
): asserts value is IdentityChallenge {
	if (!isIdentityChallenge(value)) {
		throw new InvalidIdentityError();
	}
}

/**
 * Identity Provider
 */
export interface IdentityProvider {
	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): Promise<Identity<Partial<Meta>>>;
	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<Identity>;
	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<void>;
	delete(id: AutoId): Promise<void>;
	listIdentification(id: AutoId): Promise<IdentityIdentification[]>;
	getIdentification<Meta extends Record<string, unknown>>(
		identityId: AutoId,
		type: string,
		identification: string,
	): Promise<IdentityIdentification<Meta>>;
	createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void>;
	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void>;
	deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<void>;
	listChallenge(id: AutoId): Promise<IdentityChallenge[]>;
	getChallenge<Meta extends Record<string, unknown>>(
		identityId: AutoId,
		type: string,
		challenge: string,
	): Promise<IdentityChallenge<Meta>>;
	createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void>;
	updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void>;
	deleteChallenge(id: AutoId, type: string, challenge: string): Promise<void>;
}

export class InvalidIdentityError extends Error {}
export class IdentityNotFoundError extends Error {}
export class IdentityExistsError extends Error {}
export class IdentityIdentificationNotFoundError extends Error {}
export class IdentityIdentificationExistsError extends Error {}
export class IdentityChallengeNotFoundError extends Error {}
export class IdentityChallengeExistsError extends Error {}
