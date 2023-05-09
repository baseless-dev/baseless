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

/**
 * Identity Provider
 */
export interface IdentityProvider {
	/**
	 * @throws {IdentityNotFoundError}
	 */
	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): Promise<Identity<Partial<Meta>>>;

	/**
	 * @throws {IdentityCreateError}
	 */
	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<Identity>;

	/**
	 * @throws {IdentityUpdateError}
	 */
	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {IdentityDeleteError}
	 */
	delete(id: AutoId): Promise<void>;

	listIdentification(
		id: AutoId,
	): Promise<IdentityIdentification[]>;

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	matchIdentification<Meta extends Record<string, unknown>>(
		type: string,
		identification: string,
	): Promise<IdentityIdentification<Meta>>;

	/**
	 * @throws {IdentityIdentificationCreateError}
	 */
	createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {IdentityIdentificationUpdateError}
	 */
	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {IdentityIdentificationDeleteError}
	 */
	deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<void>;

	listChallenge(id: AutoId): Promise<IdentityChallenge[]>;

	/**
	 * @throws {IdentityChallengeNotFoundError}
	 */
	getChallenge<Meta extends Record<string, unknown>>(
		identityId: AutoId,
		type: string,
	): Promise<IdentityChallenge<Meta>>;

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {IdentityChallengeUpdateError}
	 */
	updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {IdentityChallengeDeleteError}
	 */
	deleteChallenge(
		id: AutoId,
		type: string,
	): Promise<void>;
}
