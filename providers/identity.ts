import type { IdentityChallenge } from "../common/identity/challenge.ts";
import type {
	IdentityChallengeCreateError,
	IdentityChallengeDeleteError,
	IdentityChallengeNotFoundError,
	IdentityChallengeUpdateError,
	IdentityCreateError,
	IdentityDeleteError,
	IdentityIdentificationCreateError,
	IdentityIdentificationDeleteError,
	IdentityIdentificationNotFoundError,
	IdentityIdentificationUpdateError,
	IdentityNotFoundError,
	IdentityUpdateError,
} from "../common/identity/errors.ts";
import type { IdentityIdentification } from "../common/identity/identification.ts";
import type { Identity } from "../common/identity/identity.ts";
import type { AutoId } from "../common/system/autoid.ts";
import type { Result } from "../common/system/result.ts";

/**
 * Identity Provider
 */
export interface IdentityProvider {
	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): Promise<Result<Identity<Partial<Meta>>, IdentityNotFoundError>>;
	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<Result<Identity, IdentityCreateError>>;
	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<Result<void, IdentityUpdateError>>;
	delete(id: AutoId): Promise<Result<void, IdentityDeleteError>>;
	listIdentification(
		id: AutoId,
	): Promise<Result<IdentityIdentification[], never>>;
	matchIdentification<Meta extends Record<string, unknown>>(
		type: string,
		identification: string,
	): Promise<
		Result<IdentityIdentification<Meta>, IdentityIdentificationNotFoundError>
	>;
	createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<Result<void, IdentityIdentificationCreateError>>;
	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<Result<void, IdentityIdentificationUpdateError>>;
	deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<Result<void, IdentityIdentificationDeleteError>>;
	listChallenge(id: AutoId): Promise<Result<IdentityChallenge[], never>>;
	getChallenge<Meta extends Record<string, unknown>>(
		identityId: AutoId,
		type: string,
	): Promise<Result<IdentityChallenge<Meta>, IdentityChallengeNotFoundError>>;
	createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<Result<void, IdentityChallengeCreateError>>;
	updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<Result<void, IdentityChallengeUpdateError>>;
	deleteChallenge(
		id: AutoId,
		type: string,
	): Promise<Result<void, IdentityChallengeDeleteError>>;
}
