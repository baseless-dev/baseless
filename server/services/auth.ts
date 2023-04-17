import {
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
	): Promise<IteratorResult<AuthenticationStep, undefined>> {
		state ??= { choices: [] };
		const step = flatten(
			await simplifyWithContext(
				this.#configuration.auth.flow.step,
				request,
				context,
				state,
			),
		);
		return getAuthenticationStepAtPath(step, state.choices);
	}

	async submitIdentification(
		request: Request,
		context: NonExtendableContext,
		state: AuthenticationState,
		identification: string,
	) {
	}

	async submitChallenge(
		request: Request,
		context: NonExtendableContext,
		state: AuthenticationState,
		challenge: string,
	) {
	}

	// signOut(): Promise<void>
}

export class UnknownIdenticatorError extends Error { }
export class UnknownChallengerError extends Error { }
