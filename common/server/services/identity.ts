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
import type { Message } from "../../message/message.ts";
import type { IdentityChallenge } from "../../identity/challenge.ts";

export interface IIdentityService {
	/**
	 * @throws {IdentityNotFoundError}
	 */
	get(identityId: AutoId): Promise<Identity>;

	/**
	 * @throws {IdentityNotFoundError}
	 */
	getByIdentification(type: string, identification: string): Promise<Identity>;

	/**
	 * @throws {IdentityCreateError}
	 */
	create(
		meta: Record<string, unknown>,
		identifications: Identity["identifications"],
		challenges: Identity["challenges"],
	): Promise<Identity>;

	/**
	 * @throws {IdentityUpdateError}
	 */
	update(
		identity: Identity,
	): Promise<void>;

	/**
	 * @throws {IdentityDeleteError}
	 */
	delete(identityId: AutoId): Promise<void>;

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	getChallengeMeta(
		type: string,
		challenge: string,
	): Promise<IdentityChallenge["meta"]>;

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
