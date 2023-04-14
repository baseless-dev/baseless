import { AuthenticationState, AuthenticationStep } from "../auth/flow.ts";
import { Configuration } from "../config.ts";
import { CounterService } from "./counter.ts";
import { IdentityService } from "./identity.ts";

export type AuthenticationPrompt = {
	step: AuthenticationStep;
	lastStep: boolean;
	firstStep: boolean;
	state: AuthenticationState;
};

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

	getAuthenticationPrompt(
		state: AuthenticationState,
	): Promise<AuthenticationPrompt> {
		throw new Error(`Unimplemented.`);
	}

	// startAuthentification(): Promise<AuthentificationSession>
	// getNextAuthentificationStep(authenticationSession): Promise<PossibleSteps>
	// performAuthentificationIdentificationStep(authenticationSession, identification): Promise<IdentificationResult>
	// performAuthentificationChallengeStep(authenticationSession, challenge): Promise<ChallengeResult>

	// signOut(): Promise<void>
}

export class UnknownIdenticatorError extends Error {}
export class UnknownChallengerError extends Error {}
