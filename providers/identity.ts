import type { IdentityChallenge } from "../common/identity/challenge.ts";
import type {
	// deno-lint-ignore no-unused-vars
	IdentityChallengeCreateError,
	// deno-lint-ignore no-unused-vars
	IdentityChallengeDeleteError,
	// deno-lint-ignore no-unused-vars
	IdentityChallengeNotFoundError,
	// deno-lint-ignore no-unused-vars
	IdentityChallengeUpdateError,
	// deno-lint-ignore no-unused-vars
	IdentityCreateError,
	// deno-lint-ignore no-unused-vars
	IdentityDeleteError,
	// deno-lint-ignore no-unused-vars
	IdentityIdentificationCreateError,
	// deno-lint-ignore no-unused-vars
	IdentityIdentificationDeleteError,
	// deno-lint-ignore no-unused-vars
	IdentityIdentificationNotFoundError,
	// deno-lint-ignore no-unused-vars
	IdentityIdentificationUpdateError,
	// deno-lint-ignore no-unused-vars
	IdentityNotFoundError,
	// deno-lint-ignore no-unused-vars
	IdentityUpdateError,
} from "../common/identity/errors.ts";
// deno-lint-ignore no-unused-vars
import type { MessageSendError } from "../common/message/errors.ts";
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
	get(id: AutoId): Promise<Identity>;

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
		identity: Identity,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {IdentityDeleteError}
	 */
	delete(id: AutoId): Promise<void>;

	listIdentification(
		id: AutoId,
	): Promise<string[]>;

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	matchIdentification(
		type: string,
		identification: string,
	): Promise<IdentityIdentification>;

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	getIdentification(
		identityId: AutoId,
		type: string,
	): Promise<IdentityIdentification>;

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
	): Promise<void>;

	listChallenge(id: AutoId): Promise<string[]>;

	/**
	 * @throws {IdentityChallengeNotFoundError}
	 */
	getChallenge(
		identityId: AutoId,
		type: string,
	): Promise<IdentityChallenge>;

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
