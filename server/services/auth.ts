import {
	AuthenticationCeremonyComponentChallengeFailedError,
	AuthenticationCeremonyDoneError,
	AuthenticationConfirmValidationCodeError,
	AuthenticationInvalidStepError,
	AuthenticationRateLimitedError,
	AuthenticationSendValidationCodeError,
} from "../../common/auth/errors.ts";
import { AuthenticationCeremonyResponse } from "../../common/auth/ceremony/response.ts";
import { isAuthenticationCeremonyResponseState } from "../../common/auth/ceremony/response/state.ts";
import {
	assertAuthenticationCeremonyStateIdentified,
	AuthenticationCeremonyState,
	isAuthenticationCeremonyStateIdentified,
} from "../../common/auth/ceremony/state.ts";
import { isAuthenticationCeremonyComponentChoice } from "../../common/auth/ceremony/component/choice.ts";
import { flatten } from "../../common/auth/ceremony/component/flatten.ts";
import { getComponentAtPath } from "../../common/auth/ceremony/component/get_component_at_path.ts";
import {
	simplify,
	simplifyWithContext,
} from "../../common/auth/ceremony/component/simplify.ts";
import { AutoId } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { otp } from "../../common/system/otp.ts";
import { CounterProvider } from "../../providers/counter.ts";
import { IdentityProvider } from "../../providers/identity.ts";
import { KVProvider } from "../../providers/kv.ts";
import {
	AuthenticationMissingChallengerError,
	AuthenticationMissingIdentificatorError,
} from "../auth/config.ts";
import { Configuration } from "../config.ts";
import { Context } from "../context.ts";

export class AuthenticationService {
	#logger = createLogger("auth-service");
	#configuration: Configuration;
	#identityProvider: IdentityProvider;
	#counterProvider: CounterProvider;
	#kvProvider: KVProvider;

	constructor(
		configuration: Configuration,
		identityProvider: IdentityProvider,
		counterProvider: CounterProvider,
		kvProvider: KVProvider,
	) {
		this.#configuration = configuration;
		this.#identityProvider = identityProvider;
		this.#counterProvider = counterProvider;
		this.#kvProvider = kvProvider;
	}

	async getAuthenticationCeremony(
		state?: AuthenticationCeremonyState,
		context?: Context,
	): Promise<AuthenticationCeremonyResponse> {
		state ??= { choices: [] };
		const step = flatten(
			context
				? await simplifyWithContext(
					this.#configuration.auth.ceremony,
					context,
					state,
				)
				: simplify(this.#configuration.auth.ceremony),
		);
		const result = getComponentAtPath(step, state.choices);
		if (result.done) {
			if (isAuthenticationCeremonyStateIdentified(state)) {
				return { done: true, identityId: state.identity };
			}
			throw new AuthenticationCeremonyDoneError();
		}
		const last = isAuthenticationCeremonyComponentChoice(result.component)
			? false
			: getComponentAtPath(step, [...state.choices, result.component.type])
				.done;
		const first = state.choices.length === 0;
		return { done: false, component: result.component, first, last, state };
	}

	async submitAuthenticationIdentification(
		state: AuthenticationCeremonyState,
		type: string,
		identification: string,
		subject: string,
	): Promise<AuthenticationCeremonyResponse> {
		const counterInterval =
			this.#configuration.auth.security.rateLimit.identificationInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
		if (
			await this.#counterProvider.increment(counterKey, 1, counterInterval) >
			this.#configuration.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getAuthenticationCeremony(state);
		if (!isAuthenticationCeremonyResponseState(result)) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = isAuthenticationCeremonyComponentChoice(result.component)
			? result.component.components.find((s) => s.type === type)
			: result.component;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const identificator = this.#configuration.auth.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const identityIdentification = await this.#identityProvider
			.matchIdentification(type, identification);

		const identifyResult = await identificator.identify(
			identityIdentification,
			identification,
		);
		if (identifyResult instanceof URL) {
			return { done: false, redirect: identifyResult };
		}
		const newState = {
			choices: [...state.choices, type],
			identity: identityIdentification.identityId,
		};
		const newResult = await this.getAuthenticationCeremony(newState);
		return newResult;
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {AuthenticationInvalidStepError}
	 */
	async submitAuthenticationChallenge(
		state: AuthenticationCeremonyState,
		type: string,
		challenge: string,
		subject: string,
	): Promise<AuthenticationCeremonyResponse> {
		assertAuthenticationCeremonyStateIdentified(state);

		const counterInterval =
			this.#configuration.auth.security.rateLimit.identificationInterval;
		const counterLimit =
			this.#configuration.auth.security.rateLimit.identificationCount;
		const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
		const counter = await this.#counterProvider.increment(
			counterKey,
			1,
			counterInterval,
		);
		if (counter > counterLimit) {
			throw new AuthenticationRateLimitedError();
		}

		const result = await this.getAuthenticationCeremony(state);
		if (!isAuthenticationCeremonyResponseState(result)) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = isAuthenticationCeremonyComponentChoice(result.component)
			? result.component.components.find((s) => s.type === type)
			: result.component;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const challenger = this.#configuration.auth.chalengers.get(step.type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}

		const identityChallenge = await this.#identityProvider.getChallenge(
			state.identity,
			step.type,
		);

		if (!await challenger.verify(identityChallenge, challenge)) {
			throw new AuthenticationCeremonyComponentChallengeFailedError();
		}

		const newState = {
			choices: [...state.choices, type],
			identity: state.identity,
		};
		const newResult = await this.getAuthenticationCeremony(newState);
		return newResult;
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {AuthenticationSendValidationCodeError}
	 */
	async sendIdentificationValidationCode(
		identityId: AutoId,
		type: string,
	): Promise<void> {
		const identificator = this.#configuration.auth.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationSendValidationCodeError();
		}

		if (identificator.sendMessage) {
			if (identificator.sendInterval && identificator.sendCount) {
				const counterInterval = identificator.sendInterval;
				const counterLimit = identificator.sendCount;
				const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
				const counterKey =
					`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
				const counter = await this.#counterProvider.increment(
					counterKey,
					1,
					counterInterval,
				);
				if (counter > counterLimit) {
					throw new AuthenticationRateLimitedError();
				}
			}
			const code = otp({ digits: 6 });
			await this.#kvProvider.put(
				`/auth/validationcode/${identityId}/${type}`,
				code,
				{ expiration: 1000 * 60 * 5 },
			);

			const identityIdentifications = await this.#identityProvider
				.listIdentification(identityId);
			const identityIdentification = identityIdentifications.find((ii) =>
				ii.type === type
			);
			if (identityIdentification) {
				await identificator.sendMessage(identityIdentification, { text: code });
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
			const counterInterval = this.#configuration.auth.security.rateLimit
				.confirmVerificationCodeInterval;
			const counterLimit = this.#configuration.auth.security.rateLimit
				.confirmVerificationCodeCount;
			const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
			const counterKey =
				`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
			const counter = await this.#counterProvider.increment(
				counterKey,
				1,
				counterInterval,
			);
			if (counter > counterLimit) {
				throw new AuthenticationRateLimitedError();
			}

			const identityIdentifications = await this.#identityProvider
				.listIdentification(identityId);
			const identityIdentification = identityIdentifications.find((ii) =>
				ii.type === type
			);
			if (!identityIdentification) {
				throw new AuthenticationConfirmValidationCodeError();
			}

			const savedCode = await this.#kvProvider.get(
				`/auth/validationcode/${identityId}/${type}`,
			).catch((_) => undefined);
			if (savedCode?.value === code) {
				await this.#identityProvider.updateIdentification({
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
}
