import { AutoId, isAutoId } from "../../shared/autoid.ts";

export interface Identity<Meta = Record<never, never>> {
	readonly id: AutoId;
	readonly meta: Meta;
}

export interface IdentityIdentification {
	readonly identityId: AutoId;
	readonly id: AutoId;
	readonly type: string;
	readonly identification: string
}

export interface IdentityChallenge {
	readonly identityId: AutoId;
	readonly id: AutoId;
	readonly type: string;
	readonly challenge: string
}

export function isIdentity(value?: unknown): value is Identity {
	return !!value && typeof value === "object" && "id" in value && isAutoId(value.id);
}

export function assertIdentity(value?: unknown): asserts value is Identity {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}

export function isIdentityIdentification(value?: unknown): value is IdentityIdentification {
	return !!value && typeof value === "object" && "identityId" in value && "id" in value && "type" in value && "identification" in value && isAutoId(value.identityId) && isAutoId(value.id);
}

export function assertIdentityIdentification(value?: unknown): asserts value is IdentityIdentification {
	if (!isIdentityIdentification(value)) {
		throw new InvalidIdentityError();
	}
}

export function isIdentityChallenge(value?: unknown): value is IdentityChallenge {
	return !!value && typeof value === "object" && "identityId" in value && "id" in value && "type" in value && "challenge" in value && isAutoId(value.identityId) && isAutoId(value.id);
}

export function assertIdentityChallenge(value?: unknown): asserts value is IdentityChallenge {
	if (!isIdentityChallenge(value)) {
		throw new InvalidIdentityError();
	}
}

/**
 * Identity Provider
 */
export interface IdentityProvider {
	/**
	 * Check if the {@link Identity} exists or not
	 * @param identityId The {@link Identity.id}
	 * @returns Wether the {@link Identity} exists or not
	 */
	identityExists(identityId: AutoId): Promise<boolean>;

	/**
	 * Get an Identity by Id
	 * @param identityId The {@link Identity.id}
	 */
	getIdentityById<Meta>(identityId: AutoId): Promise<Identity<Partial<Meta>>>;

	/**
	 * Delete an Identity by it's Id
	 * @param identityId The {@link Identity.id}
	 */
	deleteIdentityById(identityId: AutoId): Promise<void>;

	/**
	 * Create an Identity
	 * @param identityId The {@link Identity.id}
	 * @param meta The {@link Identity.meta}
	 */
	createIdentity(meta: Record<string, string>): Promise<AutoId>;

	/**
	 * Update an Identity
	 * @param identityId The {@link Identity.id}
	 * @param meta The {@link Identity.meta}
	 */
	updateIdentity(identityId: AutoId, meta: Record<string, string>): Promise<void>;

	/**
	 * Assign {@link authStepIdent} identifier to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param type The {@link authStepIdent} (ex. email, oauth:github)
	 * @param identification The unique Id (ex. john@doe.local, grenierdev)
	 * @param expiration The time to live in seconds or Date at wich the identification expire
	 */
	assignIdentityIdentification(identityId: AutoId, type: string, identification: string, expiration?: number | Date): Promise<IdentityIdentification>;

	/**
	 * Get {@link IdentityIdentification} by {@link IdentityIdentification.id}
	 * @param identityId The {@link Identity.id}
	 * @param identificationId The {@link IdentityIdentification.id}
	 */
	getIdentityIdentificationById(identityId: AutoId, identificationId: AutoId): Promise<IdentityIdentification>;

	/**
	 * Get the {@link Identity.id} by it's {@link authStepIdent} and an unique ID for this identifier
	 * @param type The {@link authStepIdent} (ex. email, oauth:github)
	 * @param identification The unique Id (ex. john@doe.local, grenierdev)
	 */
	getIdentityIdentificationByType(type: string, identification: string): Promise<IdentityIdentification>;

	/**
	 * List all {@link authStepIdent} identifier assigned to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param type The type of identification to filter
	 */
	listIdentityIdentification(identityId: AutoId, type?: string): Promise<IdentityIdentification[]>;

	/**
	 * Unassign {@link IdentityAuthStep} identifier to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param identificationId The {@link IdentityIdentification.id}
	 */
	unassignIdentityIdentification(identityId: AutoId, identificationId: AutoId): Promise<void>;

	/**
	 * Test {@link authStepIdent} challenge for an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param type The {@link authStepIdent} (ex. password, otp)
	 * @param challenge The challenge (ex. encrypted password, 6 digits code)
	 * @returns Wether the challenge failed or not
	 */
	testIdentityChallenge(identityId: AutoId, type: string, challenge: string): Promise<boolean>;

	/**
	 * Assign {@link authStepIdent} challenge to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param type The {@link authStepIdent} (ex. password, otp)
	 * @param challenge The challenge (ex. encrypted password, 6 digits code)
	 * @param expiration The time to live in seconds or Date at wich the challenge expire (ex. forgot password)
	 */
	assignIdentityChallenge(identityId: AutoId, type: string, challenge: string, expiration?: number | Date): Promise<IdentityChallenge>;

	/**
	 * Get {@link IdentityChallenge} by {@link IdentityChallenge.id}
	 * @param identityId The {@link Identity.id}
	 * @param challengeId The {@link IdentityChallenge.id}
	 */
	getIdentityChallengeById(identityId: AutoId, challengeId: AutoId): Promise<IdentityChallenge>;

	/**
	 * List all {@link authStepIdent} challenge assigned to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param type The type of challenge to filter
	 */
	listIdentityChallenge(identityId: AutoId, type?: string): Promise<IdentityChallenge[]>;

	/**
	 * Unassign {@link authStepIdent} challenge to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param challengeId The {@link IdentityChallenge.id}
	 */
	unassignIdentityChallenge(identityId: AutoId, challengeId: AutoId): Promise<void>;
}

/**
 * Invalid Identity Error
 */
export class InvalidIdentityError extends Error { }
/**
 * Invalid Identity Authentication Step Error
 */
export class InvalidIdentityAuthenticationStepError extends Error { }
/**
 * Identity Not Found Error
 */
export class IdentityNotFoundError extends Error { }
/**
 * Identity Exists Error
 */
export class IdentityExistsError extends Error { }
/**
 * Identity Authentication Step Not Found Error
 */
export class IdentityAuthenticationStepNotFoundError extends Error { }
/**
 * Identity Authentication Step Exists Error
 */
export class IdentityAuthenticationStepExistsError extends Error { }
