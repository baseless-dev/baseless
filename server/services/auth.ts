import { AutoId } from "../../shared/autoid.ts";
import { otp } from "../../shared/otp.ts";
import {
	AuthenticationMissingChallengerError,
	AuthenticationMissingIdentificatorError,
} from "../auth/config.ts";
import {
	assertAuthenticationStateIdentified,
	AuthenticationChoice,
	AuthenticationState,
	AuthenticationStep,
	flatten,
	getAuthenticationStepAtPath,
	simplifyWithContext,
} from "../auth/flow.ts";
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

export type AuthenticationResult =
	| { done: true; identityId: AutoId }
	| { done: true; error: true }
	| { done: false; response: Response }
	| GetStepResult & { state: AuthenticationState };

export class AuthenticationService {
	#configuration: Configuration;
	#context: Context;

	constructor(
		configuration: Configuration,
		context: Context,
	) {
		this.#configuration = configuration;
		this.#context = context;
	}

	async getStep(state?: AuthenticationState): Promise<GetStepResult> {
		state ??= { choices: [] };
		const step = flatten(
			await simplifyWithContext(
				this.#configuration.auth.flow.step,
				this.#context,
				state,
			),
		);
		const result = getAuthenticationStepAtPath(step, state.choices);
		if (result.done) {
			return { done: true };
		}
		const last = result.step instanceof AuthenticationChoice
			? false
			: getAuthenticationStepAtPath(step, [...state.choices, result.step.type])
				.done;
		const first = state.choices.length === 0 &&
			result.step instanceof AuthenticationChoice;
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
			await this.#context.counter.increment(counterKey, 1, counterInterval) >
				this.#configuration.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getStep(state);
		if (result.done) {
			throw new AuthenticationFlowDoneError();
		}
		const step = result.step instanceof AuthenticationChoice
			? result.step.choices.find((s) => s.type === type)
			: result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const identificator = this.#configuration.auth.flow.identificators.get(
			step.type,
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const identityIdentification = await this.#context.identity
			.matchIdentification(step.type, identification);

		const identifyResult = await identificator.identify(
			identityIdentification,
			identification,
		);
		if (identifyResult instanceof Response) {
			return { done: false, response: identifyResult };
		}
		if (result.last) {
			return { done: true, identityId: identityIdentification.identityId };
		} else {
			const newState = {
				choices: [...state.choices, type],
				identity: identityIdentification.identityId,
			};
			return {
				...await this.getStep(newState),
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
			await this.#context.counter.increment(counterKey, 1, counterInterval) >
				this.#configuration.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}

		const result = await this.getStep(state);
		if (result.done) {
			throw new AuthenticationFlowDoneError();
		}
		const step = result.step instanceof AuthenticationChoice
			? result.step.choices.find((s) => s.type === type)
			: result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const challenger = this.#configuration.auth.flow.chalengers.get(step.type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}

		const identityChallenge = await this.#context.identity.getChallenge(
			state.identity,
			step.type,
		);
		if (!identityChallenge) {
			throw new AuthenticationMissingChallengeError();
		}

		if (!await challenger.verify(identityChallenge, challenge)) {
			throw new AuthenticationChallengeFailedError();
		}

		if (result.last) {
			return { done: true, identityId: state.identity };
		}
		const newState = {
			choices: [...state.choices, type],
			identity: state.identity,
		};
		return {
			...await this.getStep(newState),
			state: newState,
		};
		// return { done: false, state: { choices: [...state.choices, type], identity: state.identity } };
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
					await this.#context.counter.increment(
						counterKey,
						1,
						identificator.sendInterval,
					) >
						identificator.sendCount
				) {
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
			await this.#context.counter.increment(
				counterKey,
				1,
				this.#configuration.auth.security.rateLimit
					.confirmVerificationCodeInterval,
			) >
				this.#configuration.auth.security.rateLimit.confirmVerificationCodeCount
		) {
			throw new AuthenticationRateLimitedError();
		}

		const identityIdentifications = await this.#context.identity
			.listIdentification(identityId);
		const identityIdentification = identityIdentifications.find((ii) =>
			ii.type === type
		);
		if (!identityIdentification) {
			throw new AuthenticationMissingIdentificationError();
		}

		const savedCode = await this.#context.kv.get(
			`/auth/validationcode/${identityId}/${type}`,
		).catch((_) => undefined);
		if (!savedCode || savedCode.value !== code) {
			throw new AuthenticationConfirmFailedError();
		}

		await this.#context.identity.updateIdentification({
			...identityIdentification,
			verified: true,
		});
	}
}

export class AuthenticationFlowDoneError extends Error {}
export class AuthenticationInvalidStepError extends Error {}
export class AuthenticationRateLimitedError extends Error {}
export class AuthenticationMissingChallengeError extends Error {}
export class AuthenticationChallengeFailedError extends Error {}
export class AuthenticationMissingIdentificationError extends Error {}
export class AuthenticationConfirmFailedError extends Error {}
