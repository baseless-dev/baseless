import {
	AuthenticationCeremonyComponentPromptError,
	AuthenticationCeremonyDoneError,
	AuthenticationInvalidStepError,
	AuthenticationMissingIdentificatorError,
	AuthenticationRateLimitedError,
} from "../../lib/auth/errors.ts";
import { extract } from "../../lib/auth/extract.ts";
import { getComponentAtPath } from "../../lib/auth/get_component_at_path.ts";
import type { AuthenticationCeremonyComponent } from "../../lib/auth/types.ts";
import type {
	AuthenticationCeremonyComponentPrompt,
	AuthenticationSignInResponse,
	AuthenticationSignInState,
} from "../../lib/auth/types.ts";
import type { Identity } from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import { AuthenticationComponent } from "../../providers/auth_component.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { IdentityProvider } from "../../providers/identity.ts";

export class AuthenticationService {
	#logger = createLogger("auth-service");
	#ceremony: AuthenticationCeremonyComponent;
	#components: AuthenticationComponent[];
	#identityProvider: IdentityProvider;
	#counterProvider: CounterProvider;
	#rateLimit: {
		count: number;
		interval: number;
	};

	constructor(
		ceremony: AuthenticationCeremonyComponent,
		identityProvider: IdentityProvider,
		counterProvider: CounterProvider,
		rateLimit?: {
			count: number;
			interval: number;
		},
	) {
		this.#ceremony = ceremony;
		this.#components = extract(ceremony)
			.filter((c): c is AuthenticationComponent =>
				c instanceof AuthenticationComponent
			);
		this.#identityProvider = identityProvider;
		this.#counterProvider = counterProvider;
		this.#rateLimit = rateLimit ?? { count: 5, interval: 1000 * 60 * 5 };
	}

	getSignInCeremony(
		state?: AuthenticationSignInState,
	): AuthenticationSignInResponse {
		state ??= { kind: "signin", choices: [] };
		const result = getComponentAtPath(this.#ceremony, state.choices);
		if (!result || result.kind === "done") {
			if (state.identity) {
				return { done: true, identityId: state.identity };
			}
			throw new AuthenticationCeremonyDoneError();
		}
		const last = result.kind === "choice"
			? false
			: getComponentAtPath(this.#ceremony, [
				...state.choices,
				result.id,
			])?.kind === "done";
		const first = state.choices.length === 0;
		return { done: false, state, component: result, first, last };
	}

	async submitSignInPrompt(
		state: AuthenticationSignInState,
		id: string,
		value: unknown,
		subject: string,
	): Promise<AuthenticationSignInResponse> {
		const counterInterval = this.#rateLimit?.interval ?? 1000 * 60 * 5;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = [
			"auth",
			"identification",
			subject,
			slidingWindow.toString(),
		];
		if (
			await this.#counterProvider.increment(counterKey, 1, counterInterval) >
				(this.#rateLimit?.count ?? 5)
		) {
			throw new AuthenticationRateLimitedError();
		}
		const authCeremony = await this.getSignInCeremony(state);
		if (authCeremony.done === false && "state" in authCeremony) {
			const step = authCeremony.component.kind === "choice"
				? authCeremony.component.components.find((
					s,
				): s is AuthenticationCeremonyComponentPrompt =>
					s.kind === "prompt" && s.id === id
				)
				: authCeremony.component;
			if (!step || step.kind === "done") {
				throw new AuthenticationInvalidStepError();
			}
			const identificator = this.#components.find((comp) => comp.id === id);
			if (!identificator) {
				throw new AuthenticationMissingIdentificatorError();
			}
			const stateIdentity = state.identity
				? await this.#identityProvider.get(state.identity)
				: undefined;
			const identityComponent = stateIdentity?.components[step.id];
			const result = await identificator.verifyPrompt({
				value,
				identity: stateIdentity && identityComponent
					? {
						identity: stateIdentity,
						component: identityComponent,
					}
					: undefined,
			});
			let identity: Identity | undefined;
			if (
				typeof result === "object" &&
				(!stateIdentity || result.id === stateIdentity.id)
			) {
				identity = result;
			} else if (result === true && stateIdentity) {
				identity = stateIdentity;
			}
			if (!identity) {
				throw new AuthenticationCeremonyComponentPromptError();
			}

			const newState = {
				kind: "signin" as const,
				choices: [...state.choices, id],
				identity: identity.id,
			};
			const newResult = await this.getSignInCeremony(newState);
			return newResult;
		} else {
			throw new AuthenticationCeremonyDoneError();
		}
	}
}
