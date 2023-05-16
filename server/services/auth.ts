import {
	AuthenticationCeremonyComponentChallengeFailedError,
	AuthenticationCeremonyDoneError,
	AuthenticationConfirmValidationCodeError,
	AuthenticationInvalidStepError,
	AuthenticationRateLimitedError,
	AuthenticationSendIdentificationChallengeError,
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
import { simplifyWithContext } from "../../common/auth/ceremony/component/simplify.ts";
import { AutoId } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { otp } from "../../common/system/otp.ts";
import {
	AuthenticationMissingChallengerError,
	AuthenticationMissingIdentificatorError,
} from "../auth/config.ts";
import type { IContext } from "../../common/server/context.ts";
import type { IAuthenticationService } from "../../common/server/services/auth.ts";

export class AuthenticationService implements IAuthenticationService {
	#logger = createLogger("auth-service");
	#context: IContext;

	constructor(
		context: IContext,
	) {
		this.#context = context;
	}

	async getAuthenticationCeremony(
		state?: AuthenticationCeremonyState,
	): Promise<AuthenticationCeremonyResponse> {
		state ??= { choices: [] };
		const step = flatten(
			await simplifyWithContext(
				this.#context.config.auth.ceremony,
				this.#context,
				state,
			),
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
			: getComponentAtPath(step, [...state.choices, result.component.kind])
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
			this.#context.config.auth.security.rateLimit.identificationInterval *
			1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
		if (
			await this.#context.counter.increment(counterKey, 1, counterInterval) >
				this.#context.config.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getAuthenticationCeremony(state);
		if (!isAuthenticationCeremonyResponseState(result)) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = isAuthenticationCeremonyComponentChoice(result.component)
			? result.component.components.find((s) => s.kind === type)
			: result.component;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const identificator = this.#context.config.auth.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const identityIdentification = await this.#context.identity
			.matchIdentification(type, identification);

		const identifyResult = await identificator.identify({
			context: this.#context,
			identityIdentification,
			identification,
		});
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
			this.#context.config.auth.security.rateLimit.identificationInterval;
		const counterLimit =
			this.#context.config.auth.security.rateLimit.identificationCount;
		const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
		const counter = await this.#context.counter.increment(
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
			? result.component.components.find((s) => s.kind === type)
			: result.component;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const challenger = this.#context.config.auth.challengers.get(step.kind);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}

		const identityChallenge = await this.#context.identity.getChallenge(
			state.identity,
			step.kind,
		);

		if (
			!await challenger.verify({
				context: this.#context,
				identityChallenge,
				challenge,
			})
		) {
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
