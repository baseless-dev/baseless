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
	getIdentification(
		id: AutoId,
		type: string,
	): Promise<IdentityIdentification>;

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	matchIdentification(
		type: string,
		identification: string,
	): Promise<IdentityIdentification>;

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
	): Promise<void>;

	listChallenge(id: AutoId): Promise<string[]>;

	/**
	 * @throws {IdentityChallengeNotFoundError}
	 */
	getChallenge(
		id: AutoId,
		type: string,
	): Promise<IdentityChallenge>;

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	getChallengeMeta(
		type: string,
		challenge: string,
	): Promise<IdentityChallenge["meta"]>;

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

	sendChallengeValidationCode(
		identityId: AutoId,
		type: string,
		locale: string,
	): Promise<void>;

	confirmChallengeValidationCode(
		identityId: AutoId,
		type: string,
		answer: string,
	): Promise<void>;
}
