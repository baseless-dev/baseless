import {
	AuthenticationCeremonyComponentPromptError,
	AuthenticationCeremonyDoneError,
	AuthenticationInvalidStepError,
	AuthenticationMissingIdentificatorError,
	AuthenticationRateLimitedError,
	InvalidAuthenticationCeremonyComponentError,
} from "../../common/auth/errors.ts";
import type { AuthenticationCeremonyResponse } from "../../common/auth/ceremony/response.ts";
import {
	isAuthenticationCeremonyResponseDone,
	isAuthenticationCeremonyResponseState,
} from "../../common/auth/ceremony/response.ts";
import {
	type AuthenticationCeremonyState,
	isAuthenticationCeremonyStateIdentified,
} from "../../common/auth/ceremony/state.ts";
import {
	type AuthenticationCeremonyComponentPrompt,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentDone,
	isAuthenticationCeremonyComponentPrompt,
} from "../../common/auth/ceremony/ceremony.ts";
import {
	getComponentAtPath,
} from "../../common/auth/ceremony/component/get_component_at_path.ts";
import { createLogger } from "../../common/system/logger.ts";
import { Identity, isIdentity } from "../../common/identity/identity.ts";
import type { AuthenticationOptions } from "./mod.ts";

export class AuthenticationService {
	#logger = createLogger("auth-service");
	#options: AuthenticationOptions;

	constructor(
		options: AuthenticationOptions,
	) {
		this.#options = options;
	}

	async getAuthenticationCeremony(
		state?: AuthenticationCeremonyState,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				ReturnType<typeof getComponentAtPath>,
				undefined
			>
		>
	> {
		state ??= { choices: [] };
		const result = getComponentAtPath(this.#options.ceremony, state.choices);
		if (!result || isAuthenticationCeremonyComponentDone(result)) {
			if (isAuthenticationCeremonyStateIdentified(state)) {
				return { done: true, identityId: state.identity };
			}
			throw new AuthenticationCeremonyDoneError();
		}
		const last = isAuthenticationCeremonyComponentChoice(result)
			? false
			: isAuthenticationCeremonyResponseDone(
				getComponentAtPath(this.#options.ceremony, [
					...state.choices,
					result.id,
				]),
			);
		const first = state.choices.length === 0;
		return { done: false, component: result, first, last, state };
	}

	async submitComponentPrompt(
		state: AuthenticationCeremonyState,
		id: string,
		value: unknown,
		subject: string,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				ReturnType<typeof getComponentAtPath>,
				undefined
			>
		>
	> {
		const counterInterval = this.#options.rateLimit?.interval ?? 1000 * 60 * 5;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = [
			"auth",
			"identification",
			subject,
			slidingWindow.toString(),
		];
		if (
			await this.#options.counter.increment(counterKey, 1, counterInterval) >
				(this.#options.rateLimit?.count ?? 5)
		) {
			throw new AuthenticationRateLimitedError();
		}
		const authCeremony = await this.getAuthenticationCeremony(state);
		if (!isAuthenticationCeremonyResponseState(authCeremony)) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = isAuthenticationCeremonyComponentChoice(authCeremony.component)
			? authCeremony.component.components.find((
				s,
			): s is AuthenticationCeremonyComponentPrompt =>
				isAuthenticationCeremonyComponentPrompt(s) && s.id === id
			)
			: authCeremony.component;
		if (!step || isAuthenticationCeremonyComponentDone(step)) {
			throw new AuthenticationInvalidStepError();
		}

		const identificator = this.#options.components.find((comp) =>
			comp.id === id
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const stateIdentity = isAuthenticationCeremonyStateIdentified(state)
			? await this.#options.identity.get(state.identity)
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
			isIdentity(result) && (!stateIdentity || result.id === stateIdentity.id)
		) {
			identity = result;
		} else if (result === true && stateIdentity) {
			identity = stateIdentity;
		}
		if (!identity) {
			throw new AuthenticationCeremonyComponentPromptError();
		}

		const newState = {
			choices: [...state.choices, id],
			identity: identity.id,
		};
		const newResult = await this.getAuthenticationCeremony(newState);
		return newResult;
	}
}
