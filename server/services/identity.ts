import { MessageSendError } from "../../client/errors.ts";
import {
	AuthenticationConfirmValidationCodeError,
	AuthenticationMissingChallengerError,
	AuthenticationRateLimitedError,
	AuthenticationSendIdentificationChallengeError,
	AuthenticationSendValidationCodeError,
} from "../../common/auth/errors.ts";
import type { IdentityChallenge } from "../../common/identity/challenge.ts";
import {
	// deno-lint-ignore no-unused-vars
	IdentityCreateError,
	// deno-lint-ignore no-unused-vars
	IdentityDeleteError,
	// deno-lint-ignore no-unused-vars
	IdentityNotFoundError,
	// deno-lint-ignore no-unused-vars
	IdentityUpdateError,
} from "../../common/identity/errors.ts";
import {
	type Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../../common/identity/identity.ts";
import { assertMessage, type Message } from "../../common/message/message.ts";
import { type IContext } from "../../common/server/context.ts";
import { type IIdentityService } from "../../common/server/services/identity.ts";
import { assertAutoId, type AutoId } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { otp } from "../../common/system/otp.ts";
import { type IdentityProvider } from "../../providers/identity.ts";

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
	get(identityId: AutoId): Promise<Identity> {
		return this.#identityProvider.get(identityId);
	}

	/**
	 * @throws {IdentityNotFoundError}
	 */
	getByIdentification(type: string, identification: string): Promise<Identity> {
		return this.#identityProvider.getByIdentification(type, identification);
	}

	/**
	 * @throws {IdentityCreateError}
	 */
	create(
		meta: Record<string, unknown>,
		identifications: Identity["identifications"],
		challenges: Identity["challenges"],
	): Promise<Identity> {
		// TODO life cycle hooks
		return this.#identityProvider.create(meta, identifications, challenges);
	}

	/**
	 * @throws {IdentityUpdateError}
	 */
	update(
		identity: Identity,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.update(identity);
	}

	/**
	 * @throws {IdentityDeleteError}
	 */
	delete(identityId: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.delete(identityId);
	}

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	async getChallengeMeta(
		type: string,
		challenge: string,
	): Promise<IdentityChallenge["meta"]> {
		const challenger = this.#context.config.auth.challengers.get(type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}
		const meta = await challenger.configureIdentityChallenge?.({
			context: this.#context,
			challenge,
		});
		return meta ?? {};
	}

	/**
	 * @throws {MessageSendError}
	 */
	public async broadcastMessage(
		identityId: AutoId,
		message: Omit<Message, "recipient">,
	): Promise<void> {
		try {
			assertAutoId(identityId, IDENTITY_AUTOID_PREFIX);
			assertMessage(message);
			const identity = await this.#identityProvider.get(identityId);
			const confirmedIdentifications = Object.values(identity.identifications)
				.filter((i) => i.confirmed);
			const sendMessages = confirmedIdentifications.reduce(
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
			assertAutoId(identityId, IDENTITY_AUTOID_PREFIX);
			assertMessage(message);
			const identity = await this.#identityProvider.get(identityId);
			const identicator = this.#context.config.auth.identificators
				.get(
					identificationType,
				);
			if (identicator && identicator.sendMessage) {
				const identityIdentification =
					identity.identifications[identificationType];
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
			const identity = await this.#identityProvider.get(identityId);
			const identityIdentification = identity.identifications[type];
			if (!identityIdentification) {
				throw new AuthenticationSendValidationCodeError();
			}
			const code = otp({ digits: 6 });
			await this.#context.kv.put(
				["auth", "validationcode", identityId, type],
				code,
				{ expiration: 1000 * 60 * 5 },
			);
			// TODO actual message from locale
			await identificator.sendMessage({
				context: this.#context,
				identityIdentification,
				message: { text: code },
			});
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

			const identity = await this.#identityProvider.get(identityId);
			const identityIdentification = identity.identifications[type];
			if (!identityIdentification) {
				throw new AuthenticationConfirmValidationCodeError();
			}

			const savedCode = await this.#context.kv.get(
				["auth", "validationcode", identityId, type],
			).catch((_) => undefined);
			if (savedCode?.value === code) {
				identity.identifications[type] = {
					...identityIdentification,
					confirmed: true,
				};
				await this.#context.identity.update(identity);
				return;
			}
		} catch (inner) {
			this.#logger.error(
				`Failed to confirm identification validation code, got ${inner}`,
			);
		}
		throw new AuthenticationConfirmValidationCodeError();
	}

	async sendChallengeValidationCode(
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

		const identity = await this.#identityProvider.get(identityId);
		const identityChallenge = identity.challenges[type];
		if (!identityChallenge) {
			throw new AuthenticationSendValidationCodeError();
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
				identityId: identity.id,
				identityChallenge,
				context: this.#context,
				locale,
			});
		}
	}

	async confirmChallengeValidationCode(
		identityId: AutoId,
		type: string,
		answer: string,
	): Promise<void> {
		const challenger = this.#context.config.auth.challengers.get(
			type,
		);
		if (!challenger) {
			throw new AuthenticationConfirmValidationCodeError();
		}

		const identity = await this.#identityProvider.get(identityId);
		const identityChallenge = identity.challenges[type];
		if (!identityChallenge) {
			throw new AuthenticationConfirmValidationCodeError();
		}

		const result = await challenger.verify({
			identityId: identity.id,
			identityChallenge,
			context: this.#context,
			challenge: answer,
		});
		if (result) {
			identity.challenges[type] = {
				...identityChallenge,
				confirmed: true,
			};
			await this.#context.identity.update(identity);
			return;
		}
		throw new AuthenticationConfirmValidationCodeError();
	}
}
