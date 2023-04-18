import { AutoId } from "../../shared/autoid.ts";
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

	constructor(
		configuration: Configuration,
		identityService: IdentityService,
		counterService: CounterService,
	) {
		this.#configuration = configuration;
		this.#identityService = identityService;
		this.#counterService = counterService;
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
	) {
		const ip = request.headers.get("X-Real-Ip") ?? "";
		const counterInterval = context.config.auth.rateLimit.identificationInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${state.identity ?? ip}/${slidingWindow}`;
		if (await context.counter.increment(counterKey, 1, counterInterval) > context.config.auth.rateLimit.identificationCount) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getStep(request, context, state);
		if (result.done) {
			throw new AuthenticationFlowDoneError();
		}
		const step = result.step instanceof AuthenticationChoice ? result.step.choices.find(s => s.type === type) : result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}
		// get AuthenticationIdentificator by step.type
		// identificator.identify
		// if last then emit session
	}

	// async submitChallenge(
	// 	request: Request,
	// 	context: NonExtendableContext,
	// 	state: AuthenticationState,
	// 	type: string,
	// ) {
	// 	const result = await this.getStep(request, context, state);
	// 	if (result.done) {
	// 		throw new AuthenticationFlowDoneError();
	// 	}
	// 	const { step, first, last } = result;
	// 	// rate limit state.identity or X-Real-Ip
	// 	// if step instanceof AuthenticationChoice then find step.type === type else throw
	// 	// get AuthenticationChallenger by step.type
	// 	// challenger.validate
	//	// if last then emit session
	// }

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