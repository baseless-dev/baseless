import {
	AuthenticationChallengeFailedError,
	AuthenticationConfirmValidationCodeError,
	AuthenticationFlowDoneError,
	AuthenticationInvalidStepError,
	AuthenticationMissingChallengeError,
	AuthenticationMissingIdentificationError,
	AuthenticationRateLimitedError,
	AuthenticationSendValidationCodeError,
} from "../../common/authentication/errors.ts";
import { isAuthenticationResultDone } from "../../common/authentication/results/done.ts";
import { AuthenticationResult } from "../../common/authentication/results/result.ts";
import { isAuthenticationResultState } from "../../common/authentication/results/state.ts";
import {
	assertAuthenticationStateIdentified,
	AuthenticationState,
	isAuthenticationStateIdentified,
} from "../../common/authentication/state.ts";
import {
	AuthenticationStep,
	isAuthenticationStep,
} from "../../common/authentication/step.ts";
import { isAuthenticationChoice } from "../../common/authentication/steps/choice.ts";
import { flatten } from "../../common/authentication/steps/flatten.ts";
import { getStepAtPath } from "../../common/authentication/steps/get_step_at_path.ts";
import {
	simplify,
	simplifyWithContext,
} from "../../common/authentication/steps/simplify.ts";
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

	async getStep(
		state?: AuthenticationState,
		context?: Context,
	): Promise<AuthenticationResult> {
		state ??= { choices: [] };
		const step = flatten(
			context
				? await simplifyWithContext(
					this.#configuration.auth.flow.step,
					context,
					state,
				)
				: simplify(this.#configuration.auth.flow.step),
		);
		const result = getStepAtPath(step, state.choices);
		if (result.done) {
			if (isAuthenticationStateIdentified(state)) {
				return { done: true, identityId: state.identity };
			}
			throw new AuthenticationFlowDoneError();
		}
		const last = isAuthenticationChoice(result.step)
			? false
			: getStepAtPath(step, [...state.choices, result.step.type])
				.done;
		const first = state.choices.length === 0;
		return { done: false, step: result.step, first, last, state };
	}

	async submitIdentification(
		state: AuthenticationState,
		type: string,
		identification: string,
		subject: string,
	): Promise<AuthenticationResult> {
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
		const result = await this.getStep(state);
		if (!isAuthenticationResultState(result)) {
			throw new AuthenticationFlowDoneError();
		}
		const step = isAuthenticationChoice(result.step)
			? result.step.choices.find((s) => s.type === type)
			: result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const identificator = this.#configuration.auth.flow.identificators.get(
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
		const newResult = await this.getStep(newState);
		return newResult;
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {AuthenticationInvalidStepError}
	 */
	async submitChallenge(
		state: AuthenticationState,
		type: string,
		challenge: string,
		subject: string,
	): Promise<AuthenticationResult> {
		assertAuthenticationStateIdentified(state);

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

		const result = await this.getStep(state);
		if (!isAuthenticationResultState(result)) {
			throw new AuthenticationFlowDoneError();
		}
		const step = isAuthenticationChoice(result.step)
			? result.step.choices.find((s) => s.type === type)
			: result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const challenger = this.#configuration.auth.flow.chalengers.get(step.type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}

		const identityChallenge = await this.#identityProvider.getChallenge(
			state.identity,
			step.type,
		);

		if (!await challenger.verify(identityChallenge, challenge)) {
			throw new AuthenticationChallengeFailedError();
		}

		const newState = {
			choices: [...state.choices, type],
			identity: state.identity,
		};
		const newResult = await this.getStep(newState);
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
		const identificator = this.#configuration.auth.flow.identificators.get(
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
