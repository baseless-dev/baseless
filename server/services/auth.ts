import { autoid, AutoId } from "../../shared/autoid.ts";
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
		kvService: KVService
	) {
		this.#configuration = configuration;
		this.#identityService = identityService;
		this.#counterService = counterService;
		this.#kvService = kvService;
	}

	async getStep(
		request: Request,
		context: NonExtendableContext,
		state?: AuthenticationState,
	): Promise<GetStepResult> {
		state ??= { choices: [] };
		const step = flatten(
			await simplifyWithContext(
				this.#configuration.auth.flow.step,
				request,
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
		request: Request,
		context: NonExtendableContext,
		state: AuthenticationState,
		type: string,
	): Promise<Response | AuthenticationState | AutoId> {
		// Rate limit request
		{
			const ip = request.headers.get("X-Real-Ip") ?? "";
			const counterInterval = this.#configuration.auth.rateLimit.identificationInterval * 1000;
			const slidingWindow = Math.round(Date.now() / counterInterval);
			const counterKey = `/auth/identification/${state.identity ?? ip}/${slidingWindow}`;
			if (await this.#counterService.increment(counterKey, 1, counterInterval) > this.#configuration.auth.rateLimit.identificationCount) {
				throw new AuthenticationRateLimitedError();
			}
		}
		const result = await this.getStep(request, context, state);
		if (result.done) {
			throw new AuthenticationFlowDoneError();
		}
		const step = result.step instanceof AuthenticationChoice ? result.step.choices.find(s => s.type === type) : result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}
		const identificator = this.#configuration.auth.flow.identificators.get(step.type);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}
		const identifyResult = await identificator.identify(request, context, state);
		if (identifyResult instanceof Response) {
			return identifyResult;
		}
		state = { ...state, identity: identifyResult };
		if (result.last) {
			const sessionId = autoid();
			// TODO save sessionId
			return sessionId;
		} else {
			return state;
		}
	}

	async submitChallenge(
		request: Request,
		context: NonExtendableContext,
		state: AuthenticationState,
		type: string,
	) {
		// rate limit state.identity or X-Real-Ip
		// if step instanceof AuthenticationChoice then find step.type === type else throw
		// get AuthenticationChallenger by step.type
		// challenger.validate
		// if last then emit session
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

export class AuthenticationFlowDoneError extends Error { }
export class AuthenticationInvalidStepError extends Error { }
export class AuthenticationRateLimitedError extends Error { }
export class AuthenticationMissingIdentificatorError extends Error { }