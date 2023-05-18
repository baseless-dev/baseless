import { MessageSendError } from "../../client/errors.ts";
import {
	AuthenticationConfirmValidationCodeError,
	AuthenticationMissingChallengerError,
	AuthenticationRateLimitedError,
	AuthenticationSendIdentificationChallengeError,
	AuthenticationSendValidationCodeError,
} from "../../common/auth/errors.ts";
import {
	assertIdentityChallenge,
	IdentityChallenge,
} from "../../common/identity/challenge.ts";
import {
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
	IdentityIdentificationUpdateError,
	// deno-lint-ignore no-unused-vars
	IdentityNotFoundError,
	// deno-lint-ignore no-unused-vars
	IdentityUpdateError,
} from "../../common/identity/errors.ts";
import {
	assertIdentityIdentification,
	IdentityIdentification,
} from "../../common/identity/identification.ts";
import { Identity } from "../../common/identity/identity.ts";
import { assertMessage, Message } from "../../common/message/message.ts";
import { IContext } from "../../common/server/context.ts";
import { IIdentityService } from "../../common/server/services/identity.ts";
import { assertAutoId, AutoId } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { otp } from "../../common/system/otp.ts";
import { IdentityProvider } from "../../providers/identity.ts";

export class IdentityService implements IIdentityService {
	#logger = createLogger("identity-service");
	#identityProvider: IdentityProvider;
	#context: IContext;

	constructor(
		identityProvider: IdentityProvider,
		context: IContext,
	) {
		this.#identityProvider = identityProvider;
		this.#context = context;
	}

	/**
	 * @throws {IdentityNotFoundError}
	 */
	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): Promise<Identity<Partial<Meta>>> {
		return this.#identityProvider.get(id);
	}

	/**
	 * @throws {IdentityCreateError}
	 */
	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<Identity> {
		// TODO life cycle hooks
		return this.#identityProvider.create(meta, expiration);
	}

	/**
	 * @throws {IdentityUpdateError}
	 */
	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.update(identity, expiration);
	}

	/**
	 * @throws {IdentityDeleteError}
	 */
	delete(id: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.delete(id);
	}

	listIdentification(
		id: AutoId,
	): Promise<IdentityIdentification[]> {
		return this.#identityProvider.listIdentification(id);
	}

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	getIdentification<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): Promise<IdentityIdentification<Meta>> {
		return this.#identityProvider.getIdentification(id, type);
	}

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	matchIdentification<Meta extends Record<string, unknown>>(
		type: string,
		identification: string,
	): Promise<IdentityIdentification<Meta>> {
		return this.#identityProvider.matchIdentification(type, identification);
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {IdentityIdentificationCreateError}
	 */
	async createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		const key =
			`/auth/identification/${identityIdentification.type}:${identityIdentification.identification}`;
		const result = await this.#context.counter.increment(key, 1, 5 * 60 * 1000);
		if (result > 1) {
			throw new AuthenticationRateLimitedError();
		}
		// TODO life cycle hooks
		return this.#identityProvider.createIdentification(
			identityIdentification,
			expiration,
		);
	}

	/**
	 * @throws {IdentityIdentificationUpdateError}
	 */
	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		try {
			assertIdentityIdentification(identityIdentification);
			// TODO life cycle hooks
			return this.#identityProvider.updateIdentification(
				identityIdentification,
				expiration,
			);
		} catch (_error) {
			// skip
		}
		throw new IdentityIdentificationUpdateError();
	}

	/**
	 * @throws {IdentityIdentificationDeleteError}
	 */
	deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteIdentification(
			id,
			type,
			identification,
		);
	}

	listChallenge(id: AutoId): Promise<IdentityChallenge[]> {
		return this.#identityProvider.listChallenge(id);
	}

	/**
	 * @throws {IdentityChallengeNotFoundError}
	 */
	getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): Promise<IdentityChallenge<Meta>> {
		return this.#identityProvider.getChallenge(id, type);
	}

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	async createChallenge(
		identityId: AutoId,
		type: string,
		challenge: string,
		expiration?: number | Date,
	): Promise<void> {
		const challenger = this.#context.config.auth.challengers.get(type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}
		const meta = await challenger.configureIdentityChallenge?.({
			context: this.#context,
			challenge,
		}) ??
			{};
		// TODO life cycle hooks
		return this.createChallengeWithMeta({
			identityId,
			type,
			meta,
		}, expiration);
	}

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	createChallengeWithMeta(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		try {
			assertIdentityChallenge(identityChallenge);
			// TODO life cycle hooks
			return this.#identityProvider.createChallenge(
				identityChallenge,
				expiration,
			);
		} catch (_error) {
			// skip
		}
		throw new IdentityChallengeCreateError();
	}

	/**
	 * @throws {IdentityChallengeUpdateError}
	 */
	updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.updateChallenge(
			identityChallenge,
			expiration,
		);
	}

	/**
	 * @throws {IdentityChallengeDeleteError}
	 */
	deleteChallenge(
		id: AutoId,
		type: string,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteChallenge(id, type);
	}

	/**
	 * @throws {MessageSendError}
	 */
	public async broadcastMessage(
		identityId: AutoId,
		message: Omit<Message, "recipient">,
	): Promise<void> {
		try {
			assertAutoId(identityId);
			assertMessage(message);
			const identifications = await this.#identityProvider.listIdentification(
				identityId,
			);
			const verifiedIdentifications = identifications.filter((i) => i.verified);
			const sendMessages = verifiedIdentifications.reduce(
				(messages, identityIdentification) => {
					const identicator = this.#context.config.auth.identificators
						.get(
							identityIdentification.type,
						);
					if (identicator && identicator.sendMessage) {
						messages.push(
							identicator.sendMessage({
								context: this.#context,
								identityIdentification,
								message,
							}),
						);
					}
					return messages;
				},
				[] as Promise<void>[],
			);
			await Promise.allSettled(sendMessages);
		} catch (_error) {
			throw new MessageSendError();
		}
	}

	/**
	 * @throws {MessageSendError}
	 */
	async sendMessage(
		identityId: AutoId,
		identificationType: string,
		message: Omit<Message, "recipient">,
	): Promise<void> {
		try {
			assertAutoId(identityId);
			assertMessage(message);
			const identicator = this.#context.config.auth.identificators
				.get(
					identificationType,
				);
			if (identicator && identicator.sendMessage) {
				const identityIdentification = await this.getIdentification(
					identityId,
					identificationType,
				);
				if (identityIdentification) {
					return identicator.sendMessage({
						context: this.#context,
						identityIdentification,
						message,
					});
				}
			}
		} catch (_error) {
			// skip
		}
		throw new MessageSendError();
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {AuthenticationSendValidationCodeError}
	 */
	async sendIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		_locale: string,
	): Promise<void> {
		const identificator = this.#context.config.auth.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationSendValidationCodeError();
		}

		if (identificator.sendMessage) {
			if (identificator.rateLimit.interval) {
				const { interval, count } = identificator.rateLimit;
				const slidingWindow = Math.round(Date.now() / interval * 1000);
				const counterKey =
					`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
				const counter = await this.#context.counter.increment(
					counterKey,
					1,
					interval,
				);
				if (counter > count) {
					throw new AuthenticationRateLimitedError();
				}
			}
			const code = otp({ digits: 6 });
			await this.#context.kv.put(
				`/auth/validationcode/${identityId}/${type}`,
				code,
				{ expiration: 1000 * 60 * 5 },
			);

			const identityIdentifications = await this.#context.identity
				.listIdentification(identityId);
			const identityIdentification = identityIdentifications.find((ii) =>
				ii.type === type
			);
			if (identityIdentification) {
				// TODO actual message from locale
				await identificator.sendMessage({
					context: this.#context,
					identityIdentification,
					message: { text: code },
				});
			}
		}
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {AuthenticationConfirmValidationCodeError}
	 */
	async confirmIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		code: string,
	): Promise<void> {
		try {
			const counterInterval = this.#context.config.auth.security.rateLimit
				.confirmVerificationCodeInterval;
			const counterLimit = this.#context.config.auth.security.rateLimit
				.confirmVerificationCodeCount;
			const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
			const counterKey =
				`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
			const counter = await this.#context.counter.increment(
				counterKey,
				1,
				counterInterval,
			);
			if (counter > counterLimit) {
				throw new AuthenticationRateLimitedError();
			}

			const identityIdentifications = await this.#context.identity
				.listIdentification(identityId);
			const identityIdentification = identityIdentifications.find((ii) =>
				ii.type === type
			);
			if (!identityIdentification) {
				throw new AuthenticationConfirmValidationCodeError();
			}

			const savedCode = await this.#context.kv.get(
				`/auth/validationcode/${identityId}/${type}`,
			).catch((_) => undefined);
			if (savedCode?.value === code) {
				await this.#context.identity.updateIdentification({
					...identityIdentification,
					verified: true,
				});
				return;
			}
		} catch (inner) {
			this.#logger.error(
				`Failed to confirm identification validation code, got ${inner}`,
			);
		}
		throw new AuthenticationConfirmValidationCodeError();
	}

	async sendIdentificationChallenge(
		identityId: AutoId,
		type: string,
		locale: string,
	): Promise<void> {
		const challenger = this.#context.config.auth.challengers.get(
			type,
		);
		if (!challenger) {
			throw new AuthenticationSendIdentificationChallengeError();
		}

		const identityChallenge = await this.#context.identity.getChallenge(
			identityId,
			type,
		);
		if (!identityChallenge) {
			throw new AuthenticationSendIdentificationChallengeError();
		}

		if (challenger.sendChallenge) {
			if (challenger.rateLimit.interval) {
				const { interval, count } = challenger.rateLimit;
				const slidingWindow = Math.round(Date.now() / interval * 1000);
				const counterKey =
					`/auth/sendchallenge/${identityId}/${type}/${slidingWindow}`;
				const counter = await this.#context.counter.increment(
					counterKey,
					1,
					interval,
				);
				if (counter > count) {
					throw new AuthenticationRateLimitedError();
				}
			}
			await challenger.sendChallenge({
				identityChallenge,
				context: this.#context,
				locale,
			});
		}
	}
}
