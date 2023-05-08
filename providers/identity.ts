import type { IdentityChallenge } from "../common/identity/challenge.ts";
import type { IdentityChallengeCreateError, IdentityChallengeDeleteError, IdentityChallengeNotFoundError, IdentityChallengeUpdateError, IdentityCreateError, IdentityDeleteError, IdentityIdentificationCreateError, IdentityIdentificationDeleteError, IdentityIdentificationNotFoundError, IdentityIdentificationUpdateError, IdentityNotFoundError, IdentityUpdateError } from "../common/identity/errors.ts";
import type { IdentityIdentification } from "../common/identity/identification.ts";
import type { Identity } from "../common/identity/identity.ts";
import type { AutoId } from "../common/system/autoid.ts";
import type { PromisedResult } from "../common/system/result.ts";

/**
 * Identity Provider
 */
export interface IdentityProvider {
	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): PromisedResult<Identity<Partial<Meta>>, IdentityNotFoundError>;
	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): PromisedResult<Identity, IdentityCreateError>;
	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): PromisedResult<void, IdentityUpdateError>;
	delete(id: AutoId): PromisedResult<void, IdentityDeleteError>;
	listIdentification(id: AutoId): PromisedResult<IdentityIdentification[], never>;
	matchIdentification<Meta extends Record<string, unknown>>(
		type: string,
		identification: string,
	): PromisedResult<IdentityIdentification<Meta>, IdentityIdentificationNotFoundError>;
	createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): PromisedResult<void, IdentityIdentificationCreateError>;
	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): PromisedResult<void, IdentityIdentificationUpdateError>;
	deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): PromisedResult<void, IdentityIdentificationDeleteError>;
	listChallenge(id: AutoId): PromisedResult<IdentityChallenge[], never>;
	getChallenge<Meta extends Record<string, unknown>>(
		identityId: AutoId,
		type: string,
	): PromisedResult<IdentityChallenge<Meta>, IdentityChallengeNotFoundError>;
	createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): PromisedResult<void, IdentityChallengeCreateError>;
	updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): PromisedResult<void, IdentityChallengeUpdateError>;
	deleteChallenge(id: AutoId, type: string): PromisedResult<void, IdentityChallengeDeleteError>;
}


