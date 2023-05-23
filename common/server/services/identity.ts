import type { IdentityChallenge } from "../../identity/challenge.ts";
import type { IdentityIdentification } from "../../identity/identification.ts";
import type { Identity } from "../../identity/identity.ts";
import type { AutoId } from "../../system/autoid.ts";
import {
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
} from "../../identity/errors.ts";
// deno-lint-ignore no-unused-vars
import type { MessageSendError } from "../../message/errors.ts";
import type { Message } from "../../message/message.ts";

export interface IIdentityService {
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
	 * @throws {AuthenticationRateLimitedError}
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
		id: AutoId,
		type: string,
	): Promise<IdentityChallenge<Meta>>;

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	createChallenge(
		identityId: AutoId,
		type: string,
		challenge: string,
		expiration?: number | Date,
	): Promise<void>;

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	createChallengeWithMeta(
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

	/**
	 * @throws {MessageSendError}
	 */
	broadcastMessage(
		identityId: AutoId,
		message: Omit<Message, "recipient">,
	): Promise<void>;

	/**
	 * @throws {MessageSendError}
	 */
	sendMessage(
		identityId: AutoId,
		identificationType: string,
		message: Omit<Message, "recipient">,
	): Promise<void>;

	sendIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		locale: string,
	): Promise<void>;

	confirmIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		code: string,
	): Promise<void>;

	sendChallenge(
		identityId: AutoId,
		type: string,
		locale: string,
	): Promise<void>;
}
