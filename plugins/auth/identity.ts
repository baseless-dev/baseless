import {
	AuthenticationConfirmValidationCodeError,
	AuthenticationRateLimitedError,
	AuthenticationSendValidationCodeError,
	AuthenticationSendValidationPromptError,
} from "../../lib/auth/errors.ts";
import { extract } from "../../lib/auth/extract.ts";
import type { AuthenticationCeremonyComponent } from "../../lib/auth/types.ts";
import { type AutoId, autoid } from "../../lib/autoid.ts";
import type { Identity } from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import { MessageSendError } from "../../lib/message/errors.ts";
import { AuthenticationComponent } from "../../providers/auth_component.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { KVProvider } from "../../providers/kv.ts";
import type { Message } from "../../lib/message/types.ts";

export class IdentityService {
	#logger = createLogger("identity-service");
	#components: AuthenticationComponent[];
	#identityProvider: IdentityProvider;
	#counterProvider: CounterProvider;
	#kvProvider: KVProvider;
	#rateLimit: {
		count: number;
		interval: number;
	};
	#remoteAddress: string;

	constructor(
		ceremony: AuthenticationCeremonyComponent,
		identityProvider: IdentityProvider,
		counterProvider: CounterProvider,
		kvProvider: KVProvider,
		remoteAddress: string,
		rateLimit?: {
			count: number;
			interval: number;
		},
	) {
		this.#components = extract(ceremony)
			.filter((c): c is AuthenticationComponent =>
				c instanceof AuthenticationComponent
			);
		this.#identityProvider = identityProvider;
		this.#counterProvider = counterProvider;
		this.#kvProvider = kvProvider;
		this.#rateLimit = rateLimit ?? { count: 5, interval: 1000 * 60 * 5 };
		this.#remoteAddress = remoteAddress;
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
		// 			const identicator = this.#options.identificators
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
		// 	const identicator = this.#options.identificators
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
		componentId: string,
		locale: string,
	): Promise<void> {
		const authComponent = this.#components.find((comp) =>
			comp.id === componentId
		);
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
					componentId,
					slidingWindow.toString(),
				];
				const counter = await this.#counterProvider.increment(
					counterKey,
					1,
					interval,
				);
				if (counter > count) {
					throw new AuthenticationRateLimitedError();
				}
			}
			const identity = await this.#identityProvider.get(identityId);
			const identityComponent = identity.components[componentId];
			if (!identityComponent) {
				throw new AuthenticationSendValidationCodeError();
			}
			await authComponent.sendPrompt({
				identity,
				identityComponent,
				locale,
			});
		}
	}

	async sendComponentValidationCode(
		identityId: AutoId,
		componentId: string,
		_locale: string,
	): Promise<void> {
		const authComponent = this.#components.find((comp) =>
			comp.id === componentId
		);
		if (!authComponent) {
			throw new AuthenticationSendValidationCodeError();
		}
		if (authComponent.sendValidationCode) {
			if (authComponent.rateLimit.interval) {
				const { interval, count } = authComponent.rateLimit;
				const slidingWindow = Math.round(Date.now() / interval * 1000);
				const counterKey = [
					"auth",
					"sendvalidationcode",
					identityId,
					componentId,
					slidingWindow.toString(),
				];
				const counter = await this.#counterProvider.increment(
					counterKey,
					1,
					interval,
				);
				if (counter > count) {
					throw new AuthenticationRateLimitedError();
				}
			}
			const identity = await this.#identityProvider.get(identityId);
			const identityComponent = identity.components[componentId];
			if (!identityComponent) {
				throw new AuthenticationSendValidationCodeError();
			}
			const code = autoid("code_");
			await this.#kvProvider.put(
				["auth", "validationcode", code],
				JSON.stringify({
					identityId: identity.id,
					componentId: componentId,
				}),
				{ expiration: 1000 * 60 * 5 },
			);
			// TODO actual message from locale
			await authComponent.sendValidationCode({
				identity,
				identityComponent,
				message: { text: code },
			});
		}
	}

	async confirmComponentValidationCode(code: string): Promise<void> {
		const counterInterval = this.#rateLimit
			?.interval ?? 1000 * 60 * 5;
		const counterLimit = this.#rateLimit
			?.count ?? 5;
		const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
		const counterKey = [
			"auth",
			"sendvalidationcode",
			"remoteAddress",
			this.#remoteAddress,
			slidingWindow.toString(),
		];
		const counter = await this.#counterProvider.increment(
			counterKey,
			1,
			counterInterval,
		);
		if (counter > counterLimit) {
			throw new AuthenticationRateLimitedError();
		}

		try {
			const codeKey = await this.#kvProvider.get([
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
			await this.#identityProvider.update(identity);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to confirm identification validation code, got ${inner}`,
			);
		}
		throw new AuthenticationConfirmValidationCodeError();
	}
}
