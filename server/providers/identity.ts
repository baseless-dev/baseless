import { AutoId, isAutoId } from "../../shared/autoid.ts";
// deno-lint-ignore no-unused-vars
import type { authStepIdent } from "../../server/auth/flow.ts";

export interface Identity<Meta = Record<never, never>> {
	readonly id: AutoId;
	readonly meta: Meta;
}

export interface IdentityAuthenticationStep<Meta = Record<string, never>> {
	/**
	 * The {@link authStepIdent|authentication step identifier}
	 */
	ident: string;
	/**
	 * The ID of this authentication step (ex: john@doe.local)
	 */
	id: string;
	/**
	 * The {@see Identity.id} associated with this authentication step
	 */
	identity: AutoId;
	/**
	 * The meta data associated with the authentication step
	 */
	meta: Meta;
}

export function isIdentity(value?: unknown): value is Identity {
	return !!value && typeof value === "object" && "id" in value && isAutoId(value.id);
}

/**
 * Test if value is an Identity
 * @param value The value to test
 * @returns If value is an Identity
 */
export function assertIdentity(value?: unknown): asserts value is Identity {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}

export function isIdentityAuthenticationStep(value?: unknown): value is IdentityAuthenticationStep {
	return !!value && typeof value === "object" && "ident" in value && "id" in value && "identity" in value && isAutoId(value.identity);
}

/**
 * Test if value is an Identity
 * @param value The value to test
 * @returns If value is an Identity
 */
export function assertIdentityAuthenticationStep(value?: unknown): asserts value is IdentityAuthenticationStep {
	if (!isIdentityAuthenticationStep(value)) {
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
	createIdentity(identityId: AutoId, meta: Record<string, string>): Promise<void>;

	/**
	 * Update an Identity
	 * @param identityId The {@link Identity.id}
	 * @param meta The {@link Identity.meta}
	 */
	updateIdentity(identityId: AutoId, meta: Record<string, string>): Promise<void>;

	/**
	 * Get the {@link Identity.id} by it's {@link authStepIdent} and an unique ID for this identifier
	 * @param identifier The {@link authStepIdent} (ex. email, oauth:github)
	 * @param uniqueId The unique Id (ex. john@doe.local, grenierdev)
	 */
	getIdentityByIdentification(identifier: string, uniqueId: string): Promise<AutoId>;

	/**
	 * Assign {@link authStepIdent} identifier to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param identifier The {@link authStepIdent} (ex. email, oauth:github)
	 * @param uniqueId The unique Id (ex. john@doe.local, grenierdev)
	 */
	assignIdentityIdentification(identityId: AutoId, identifier: string, uniqueId: string): Promise<void>;

	/**
	 * List all {@link authStepIdent} identifier assigned to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 */
	listIdentityIdentification(identityId: AutoId): Promise<{ identifier: string; uniqueId: string }[]>;

	/**
	 * Unassign {@link IdentityAuthStep} identifier to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param identifier The {@link authStepIdent} (ex. email, oauth:github)
	 * @param uniqueId The unique Id (ex. john@doe.local, grenierdev)
	 */
	unassignIdentityIdentification(identityId: AutoId, identifier: string, uniqueId: string): Promise<void>;

	/**
	 * Test {@link authStepIdent} challenge for an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param identifier The {@link authStepIdent} (ex. password, otp)
	 * @param challenge The challenge (ex. encrypted password, 6 digits code)
	 * @returns Wether the challenge failed or not
	 */
	testIdentityChallenge(identityId: AutoId, identifier: string, challenge: string): Promise<boolean>;

	/**
	 * Assign {@link authStepIdent} challenge to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param identifier The {@link authStepIdent} (ex. password, otp)
	 * @param challenge The challenge (ex. encrypted password, 6 digits code)
	 * @param expireIn The number of seconds at wich the challenge expires
	 */
	assignIdentityChallenge(identityId: AutoId, identifier: string, challenge: string, expireIn?: number): Promise<void>;

	/**
	 * Assign {@link authStepIdent} challenge to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param identifier The {@link authStepIdent} (ex. password, otp)
	 * @param challenge The challenge (ex. encrypted password, 6 digits code)
	 * @param expireAt The Date at wich the challenge expires
	 */
	assignIdentityChallenge(identityId: AutoId, identifier: string, challenge: string, expireAt?: Date): Promise<void>;

	/**
	 * List all {@link authStepIdent} challenge assigned to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 */
	listIdentityChallenge(identityId: AutoId): Promise<{ identifier: string; challenge: string }[]>;

	/**
	 * Unassign {@link authStepIdent} challenge to an {@link Identity}
	 * @param identityId The {@link Identity.id}
	 * @param identifier The {@link authStepIdent} (ex. password, otp)
	 * @param challenge The unique Id (ex. encrypted password, 6 digits code)
	 */
	unassignIdentityChallenge(identityId: AutoId, identifier: string, challenge: string): Promise<void>;
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
