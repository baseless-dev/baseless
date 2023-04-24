import { assertAutoId, AutoId, autoid, isAutoId } from "../../shared/autoid.ts";
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
	isAuthenticationStateIdentified,
	simplifyWithContext,
} from "../auth/flow.ts";
import { Configuration } from "../config.ts";
import { Context } from "../context.ts";
import { SessionData } from "../providers/session.ts";
import { CounterService } from "./counter.ts";
import { IdentityService } from "./identity.ts";
import { KVService } from "./kv.ts";
import { SessionService } from "./session.ts";

export type GetStepYieldResult = {
	done: false;
	step: AuthenticationStep;
	first: boolean;
	last: boolean;
};
export type GetStepReturnResult = { done: true };
export type GetStepResult = GetStepYieldResult | GetStepReturnResult;

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
		subject: string
	): Promise<Response | AuthenticationState | SessionData> {
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
		const identificator = this.#configuration.auth.flow.identificators.get(step.type);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const identityIdentification = await this.#context.identity.getIdentification(step.type, identification);

		const identifyResult = await identificator.identify(identityIdentification, identification);
		if (identifyResult instanceof Response) {
			return identifyResult;
		}
		if (result.last) {
			return this.#context.session.create(identityIdentification.identityId, {});
		} else {
			return { choices: [...state.choices, type], identity: identityIdentification.identityId };
		}
	}

	async submitChallenge(
		state: AuthenticationState,
		type: string,
		challenge: string,
		subject: string
	): Promise<SessionData | AuthenticationState> {
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

		const identityChallenge = await this.#context.identity.getChallenge(state.identity, step.type);
		if (!identityChallenge) {
			throw new AuthenticationMissingChallengeError();
		}

		if (!await challenger.verify(identityChallenge, challenge)) {
			throw new AuthenticationChallengeFailedError();
		}

		if (result.last) {
			return this.#context.session.create(state.identity, {});
		}
		return { ...state, choices: [...state.choices, type] };
	}

	async sendIdentificationValidationCode(
		identityId: AutoId,
		type: string,
	) {
		// rate limit identity or X-Real-Ip
		// get AuthenticationIdentificator by type
		// generate code and saves it to KV
		// identificator.sendVerificationCode
	}

	async confirmIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		code: string,
	) {
		// rate limit identity or X-Real-Ip
		// get AuthenticationIdentificator by type
		// validate code with KV
	}
}

export class AuthenticationFlowDoneError extends Error { }
export class AuthenticationInvalidStepError extends Error { }
export class AuthenticationRateLimitedError extends Error { }
export class AuthenticationMissingChallengeError extends Error { }
export class AuthenticationChallengeFailedError extends Error { }
