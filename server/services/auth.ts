import { AuthenticationRateLimitedError, AuthenticationFlowDoneError, AuthenticationInvalidStepError, AuthenticationMissingChallengeError, AuthenticationChallengeFailedError, AuthenticationMissingIdentificationError, AuthenticationConfirmValidationCodeError } from "../../common/authentication/errors.ts";
import { AuthenticationResult } from "../../common/authentication/results/result.ts";
import { AuthenticationState, assertAuthenticationStateIdentified } from "../../common/authentication/state.ts";
import { AuthenticationStep, isAuthenticationStep } from "../../common/authentication/step.ts";
import { isAuthenticationChoice } from "../../common/authentication/steps/choice.ts";
import { flatten } from "../../common/authentication/steps/flatten.ts";
import { getStepAtPath } from "../../common/authentication/steps/get_step_at_path.ts";
import { simplifyWithContext, simplify } from "../../common/authentication/steps/simplify.ts";
import { AutoId } from "../../common/system/autoid.ts";
import { otp } from "../../common/system/otp.ts";
import { unwrap } from "../../common/system/result.ts";
import { CounterProvider } from "../../providers/counter.ts";
import { IdentityProvider } from "../../providers/identity.ts";
import { KVProvider } from "../../providers/kv.ts";
import {
	AuthenticationMissingChallengerError,
	AuthenticationMissingIdentificatorError,
} from "../auth/config.ts";
import { Configuration } from "../config.ts";
import { Context } from "../context.ts";

export type GetStepYieldResult = {
	done: false;
	step: AuthenticationStep;
	first: boolean;
	last: boolean;
};
export type GetStepReturnResult = { done: true };
export type GetStepResult = GetStepYieldResult | GetStepReturnResult;

export function isGetStepYieldResult(
	value?: unknown,
): value is GetStepYieldResult {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "step" in value &&
		isAuthenticationStep(value.step) && "first" in value &&
		typeof value.first === "boolean" && "last" in value &&
		typeof value.last === "boolean";
}

export function assertGetStepYieldResult(
	value: unknown,
): asserts value is GetStepYieldResult {
	if (!isGetStepYieldResult(value)) {
		throw new InvalidGetStepYieldResultError();
	}
}

export class InvalidGetStepYieldResultError extends Error { }

export function isGetStepReturnResult(
	value?: unknown,
): value is GetStepReturnResult {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true;
}

export function assertGetStepReturnResult(
	value?: unknown,
): asserts value is GetStepReturnResult {
	if (!isGetStepReturnResult(value)) {
		throw new InvalidGetStepReturnResultError();
	}
}

export class InvalidGetStepReturnResultError extends Error { }

export function isGetStepResult(value?: unknown): value is GetStepResult {
	return isGetStepYieldResult(value) || isGetStepReturnResult(value);
}

export function assertGetStepResult(
	value?: unknown,
): asserts value is GetStepResult {
	if (!isGetStepResult(value)) {
		throw new InvalidGetStepResultError();
	}
}

export class InvalidGetStepResultError extends Error { }


export class AuthenticationService {
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
	): Promise<GetStepResult> {
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
			return { done: true };
		}
		const last = isAuthenticationChoice(result.step)
			? false
			: getStepAtPath(step, [...state.choices, result.step.type])
				.done;
		const first = state.choices.length === 0;
		return { done: false, step: result.step, first, last };
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
			unwrap(await this.#counterProvider.increment(counterKey, 1, counterInterval)) >
			this.#configuration.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getStep(state);
		if (result.done) {
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

		const identityIdentification = unwrap(await this.#identityProvider
			.matchIdentification(type, identification));

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
		if (newResult.done) {
			return { done: true, identityId: identityIdentification.identityId };
		} else {
			return {
				...await this.getStep(newState) as GetStepYieldResult,
				state: newState,
			};
		}
	}

	async submitChallenge(
		state: AuthenticationState,
		type: string,
		challenge: string,
		subject: string,
	): Promise<AuthenticationResult> {
		assertAuthenticationStateIdentified(state);

		const counterInterval =
			this.#configuration.auth.security.rateLimit.identificationInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
		if (
			unwrap(await this.#counterProvider.increment(counterKey, 1, counterInterval)) >
			this.#configuration.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}

		const result = await this.getStep(state);
		if (result.done) {
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

		const identityChallenge = unwrap(await this.#identityProvider.getChallenge(
			state.identity,
			step.type,
		));
		if (!identityChallenge) {
			throw new AuthenticationMissingChallengeError();
		}

		if (!await challenger.verify(identityChallenge, challenge)) {
			throw new AuthenticationChallengeFailedError();
		}

		const newState = {
			choices: [...state.choices, type],
			identity: state.identity,
		};
		const newResult = await this.getStep(newState);
		if (newResult.done) {
			return { done: true, identityId: state.identity };
		}
		return {
			...await this.getStep(newState) as GetStepYieldResult,
			state: newState,
		};
	}

	async sendIdentificationValidationCode(
		identityId: AutoId,
		type: string,
	) {
		const identificator = this.#configuration.auth.flow.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		if (identificator.sendMessage) {
			if (identificator.sendInterval && identificator.sendCount) {
				const counterInterval = identificator.sendInterval * 1000;
				const slidingWindow = Math.round(Date.now() / counterInterval);
				const counterKey =
					`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
				if (
					unwrap(await this.#counterProvider.increment(
						counterKey,
						1,
						identificator.sendInterval,
					)) >
					identificator.sendCount
				) {
					throw new AuthenticationRateLimitedError();
				}
			}
			const code = otp({ digits: 6 });
			await this.#kvProvider.put(
				`/auth/validationcode/${identityId}/${type}`,
				code,
				{ expiration: 1000 * 60 * 5 },
			);

			const identityIdentifications = unwrap(await this.#identityProvider
				.listIdentification(identityId));
			const identityIdentification = identityIdentifications.find((ii) =>
				ii.type === type
			);
			if (!identityIdentification) {
				throw new AuthenticationMissingIdentificationError();
			}
			await identificator.sendMessage(identityIdentification, { text: code });
		}
	}

	async confirmIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		code: string,
	) {
		const counterInterval = this.#configuration.auth.security.rateLimit
			.confirmVerificationCodeInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey =
			`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
		if (
			unwrap(await this.#counterProvider.increment(
				counterKey,
				1,
				this.#configuration.auth.security.rateLimit
					.confirmVerificationCodeInterval,
			)) >
			this.#configuration.auth.security.rateLimit.confirmVerificationCodeCount
		) {
			throw new AuthenticationRateLimitedError();
		}

		const identityIdentifications = unwrap(await this.#identityProvider
			.listIdentification(identityId));
		const identityIdentification = identityIdentifications.find((ii) =>
			ii.type === type
		);
		if (!identityIdentification) {
			throw new AuthenticationMissingIdentificationError();
		}

		const savedCode = unwrap(await this.#kvProvider.get(
			`/auth/validationcode/${identityId}/${type}`,
		));
		if (!savedCode || savedCode.value !== code) {
			throw new AuthenticationConfirmValidationCodeError();
		}

		await this.#identityProvider.updateIdentification({
			...identityIdentification,
			verified: true,
		});
	}
}
