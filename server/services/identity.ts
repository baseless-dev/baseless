import { MessageSendError } from "../../client/errors.ts";
import {
	AuthenticationConfirmValidationCodeError,
	AuthenticationRateLimitedError,
	AuthenticationSendValidationCodeError,
	AuthenticationSendValidationPromptError,
} from "../../common/auth/errors.ts";
import type { Identity } from "../../common/identity/identity.ts";
import type { IContext } from "../../common/server/context.ts";
import type { IIdentityService } from "../../common/server/services/identity.ts";
import { type AutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { Message } from "../../common/message/message.ts";

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

	get(identityId: AutoId): Promise<Identity> {
		return this.#identityProvider.get(identityId);
	}

	getByIdentification(type: string, identification: string): Promise<Identity> {
		return this.#identityProvider.getByIdentification(type, identification);
	}

	create(
		meta: Record<string, unknown>,
		components: Identity["components"],
	): Promise<Identity> {
		// TODO life cycle hooks
		return this.#identityProvider.create(meta, components);
	}

	update(
		identity: Identity,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.update(identity);
	}

	delete(identityId: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.delete(identityId);
	}

	public async broadcastMessage(
		identityId: AutoId,
		component: string,
		message: Omit<Message, "recipient">,
	): Promise<void> {
		// try {
		// 	assertAutoId(identityId, IDENTITY_AUTOID_PREFIX);
		// 	assertMessage(message);
		// 	const identity = await this.#identityProvider.get(identityId);
		// 	const confirmedIdentifications = Object.values(identity.identifications)
		// 		.filter((i) => i.confirmed);
		// 	const sendMessages = confirmedIdentifications.reduce(
		// 		(messages, identityIdentification) => {
		// 			const identicator = this.#context.config.auth.identificators
		// 				.get(
		// 					identityIdentification.type,
		// 				);
		// 			if (identicator && identicator.sendMessage) {
		// 				messages.push(
		// 					identicator.sendMessage({
		// 						context: this.#context,
		// 						identityId: identity.id,
		// 						identityIdentification,
		// 						message,
		// 					}),
		// 				);
		// 			}
		// 			return messages;
		// 		},
		// 		[] as Promise<void>[],
		// 	);
		// 	await Promise.allSettled(sendMessages);
		// } catch (_error) {
		throw new MessageSendError();
		// }
	}

	async sendMessage(
		identityId: AutoId,
		component: string,
		message: Omit<Message, "recipient">,
	): Promise<void> {
		// try {
		// 	assertAutoId(identityId, IDENTITY_AUTOID_PREFIX);
		// 	assertMessage(message);
		// 	const identity = await this.#identityProvider.get(identityId);
		// 	const identicator = this.#context.config.auth.identificators
		// 		.get(
		// 			identificationType,
		// 		);
		// 	if (identicator && identicator.sendMessage) {
		// 		const identityIdentification =
		// 			identity.identifications[identificationType];
		// 		if (identityIdentification) {
		// 			return identicator.sendMessage({
		// 				context: this.#context,
		// 				identityId: identity.id,
		// 				identityIdentification,
		// 				message,
		// 			});
		// 		}
		// 	}
		// } catch (_error) {
		// 	// skip
		// }
		throw new MessageSendError();
	}

	async sendComponentPrompt(
		identityId: AutoId,
		component: string,
		locale: string,
	): Promise<void> {
		const authComponent = this.#context.config.auth.components.get(component);
		if (!authComponent) {
			throw new AuthenticationSendValidationPromptError();
		}
		if (authComponent.sendPrompt) {
			if (authComponent.rateLimit.interval) {
				const { interval, count } = authComponent.rateLimit;
				const slidingWindow = Math.round(Date.now() / interval * 1000);
				const counterKey = [
					"auth",
					"sendprompt",
					identityId,
					component,
					slidingWindow.toString(),
				];
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
			const identityComponent = identity.components[component];
			if (!identityComponent) {
				throw new AuthenticationSendValidationCodeError();
			}
			await authComponent.sendPrompt({
				context: this.#context,
				identity,
				identityComponent,
				locale,
			});
		}
	}

	async sendComponentValidationCode(
		identityId: AutoId,
		component: string,
		_locale: string,
	): Promise<void> {
		const authComponent = this.#context.config.auth.components.get(component);
		if (!authComponent) {
			throw new AuthenticationSendValidationCodeError();
		}
		if (authComponent.sendMessage) {
			if (authComponent.rateLimit.interval) {
				const { interval, count } = authComponent.rateLimit;
				const slidingWindow = Math.round(Date.now() / interval * 1000);
				const counterKey = [
					"auth",
					"sendvalidationcode",
					identityId,
					component,
					slidingWindow.toString(),
				];
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
			const identityComponent = identity.components[component];
			if (!identityComponent) {
				throw new AuthenticationSendValidationCodeError();
			}
			const code = autoid("code_");
			await this.#context.kv.put(
				["auth", "validationcode", code],
				JSON.stringify({
					identityId: identity.id,
					componentId: component,
				}),
				{ expiration: 1000 * 60 * 5 },
			);
			// TODO actual message from locale
			await authComponent.sendMessage({
				context: this.#context,
				identity,
				identityComponent,
				message: { text: code },
			});
		}
	}

	async confirmComponentValidationCode(code: string): Promise<void> {
		const counterInterval = this.#context.config.auth.security.rateLimit
			.confirmVerificationCodeInterval;
		const counterLimit = this.#context.config.auth.security.rateLimit
			.confirmVerificationCodeCount;
		const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
		const counterKey = [
			"auth",
			"sendvalidationcode",
			"remoteAddress",
			this.#context.remoteAddress,
			slidingWindow.toString(),
		];
		const counter = await this.#context.counter.increment(
			counterKey,
			1,
			counterInterval,
		);
		if (counter > counterLimit) {
			throw new AuthenticationRateLimitedError();
		}

		try {
			const codeKey = await this.#context.kv.get([
				"auth",
				"validationcode",
				code,
			]);
			const { identityId, componentId } = JSON.parse(codeKey.value);

			const identity = await this.#identityProvider.get(identityId);
			const identityComponent = identity.components[componentId];
			if (!identityComponent) {
				throw new AuthenticationConfirmValidationCodeError();
			}
			identity.components[componentId] = {
				...identityComponent,
				confirmed: true,
			};
			await this.#context.identity.update(identity);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to confirm identification validation code, got ${inner}`,
			);
		}
		throw new AuthenticationConfirmValidationCodeError();
	}
}
