import { AutoId, autoid } from "../../shared/autoid.ts";
import {
	AuthenticationChoice,
	AuthenticationState,
	AuthenticationStep,
	flatten,
	getAuthenticationStepAtPath,
	simplifyWithContext,
} from "../auth/flow.ts";
import { Configuration } from "../config.ts";
import { NonExtendableContext } from "../context.ts";
import { CounterService } from "./counter.ts";
import { IdentityService } from "./identity.ts";
import { KVService } from "./kv.ts";

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
	#identityService: IdentityService;
	#counterService: CounterService;
	#kvService: KVService;

	constructor(
		configuration: Configuration,
		identityService: IdentityService,
		counterService: CounterService,
		kvService: KVService,
	) {
		this.#configuration = configuration;
		this.#identityService = identityService;
		this.#counterService = counterService;
		this.#kvService = kvService;
	}

	async getStep(
		context: NonExtendableContext,
		state?: AuthenticationState,
	): Promise<GetStepResult> {
		state ??= { choices: [] };
		const step = flatten(
			await simplifyWithContext(
				this.#configuration.auth.flow.step,
				context,
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
		context: NonExtendableContext,
		state: AuthenticationState,
		type: string,
		request: Request,
	): Promise<Response | AuthenticationState | AutoId> {
		const counterInterval =
			this.#configuration.auth.rateLimit.identificationInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${
			state.identity ?? request.headers.get("X-Real-Ip")
		}/${slidingWindow}`;
		if (
			await this.#counterService.increment(counterKey, 1, counterInterval) >
				this.#configuration.auth.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getStep(context, state);
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
		const identifyResult = await identificator.identify(
			context,
			state,
			request,
		);
		if (identifyResult instanceof Response) {
			return identifyResult;
		}
		if (result.last) {
			const sessionId = autoid();
			// TODO session expiration
			await this.#kvService.put(`/sessions/${sessionId}`, identifyResult, {
				expiration: 3600,
			});
			return sessionId;
		} else {
			return { choices: [...state.choices, type], identity: identifyResult };
		}
	}

	async submitChallenge(
		context: NonExtendableContext,
		state: AuthenticationState,
		type: string,
		request: Request,
	) {
		const counterInterval =
			this.#configuration.auth.rateLimit.identificationInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${
			state.identity ?? request.headers.get("X-Real-Ip")
		}/${slidingWindow}`;
		if (
			await this.#counterService.increment(counterKey, 1, counterInterval) >
				this.#configuration.auth.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getStep(context, state);
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
	}

	async sendIdentificationValidationCode(
		request: Request,
		context: NonExtendableContext,
		identityId: AutoId,
		type: string,
	) {
		// rate limit identity or X-Real-Ip
		// get AuthenticationIdentificator by type
		// generate code and saves it to KV
		// identificator.sendVerificationCode
	}

	async confirmIdentificationValidationCode(
		request: Request,
		context: NonExtendableContext,
		identityId: AutoId,
		type: string,
		code: string,
	) {
		// rate limit identity or X-Real-Ip
		// get AuthenticationIdentificator by type
		// validate code with KV
	}

	async signOut(
		request: Request,
		context: NonExtendableContext,
	): Promise<void> {
		// destroy session from request
	}
}

export class AuthenticationFlowDoneError extends Error {}
export class AuthenticationInvalidStepError extends Error {}
export class AuthenticationRateLimitedError extends Error {}
export class AuthenticationMissingIdentificatorError extends Error {}
export class AuthenticationMissingChallengerError extends Error {}
