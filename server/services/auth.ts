import {
	AuthenticationCeremonyComponentPromptError,
	AuthenticationCeremonyDoneError,
	AuthenticationInvalidStepError,
	AuthenticationMissingIdentificatorError,
	AuthenticationRateLimitedError,
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
	type AuthenticationCeremonyComponentConditional,
	type AuthenticationCeremonyComponentPrompt,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentDone,
	isAuthenticationCeremonyComponentPrompt,
} from "../../common/auth/ceremony/ceremony.ts";
import {
	getComponentAtPath,
} from "../../common/auth/ceremony/component/get_component_at_path.ts";
import { createLogger } from "../../common/system/logger.ts";
import type { IContext } from "../../common/server/context.ts";
import type { IAuthenticationService } from "../../common/server/services/auth.ts";
import { resolveConditional } from "../../common/auth/ceremony/component/resolve_conditional.ts";
import { Identity, isIdentity } from "../../common/identity/identity.ts";

export class AuthenticationService implements IAuthenticationService {
	#logger = createLogger("auth-service");
	#context: IContext;

	constructor(
		context: IContext,
	) {
		this.#context = context;
	}

	async getAuthenticationCeremony(
		state?: AuthenticationCeremonyState,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				ReturnType<typeof getComponentAtPath>,
				AuthenticationCeremonyComponentConditional | undefined
			>
		>
	> {
		state ??= { choices: [] };
		const step = await resolveConditional(
			this.#context.config.auth.ceremony,
			this.#context,
			state,
		);
		const result = getComponentAtPath(step, state.choices) as Exclude<
			ReturnType<typeof getComponentAtPath>,
			AuthenticationCeremonyComponentConditional
		>;
		if (!result || isAuthenticationCeremonyComponentDone(result)) {
			if (isAuthenticationCeremonyStateIdentified(state)) {
				return { done: true, identityId: state.identity };
			}
			throw new AuthenticationCeremonyDoneError();
		}
		const last = isAuthenticationCeremonyComponentChoice(result)
			? false
			: isAuthenticationCeremonyResponseDone(
				getComponentAtPath(step, [...state.choices, result.id]),
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
				AuthenticationCeremonyComponentConditional | undefined
			>
		>
	> {
		const counterInterval =
			this.#context.config.auth.security.rateLimit.identificationInterval *
			1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = [
			"auth",
			"identification",
			subject,
			slidingWindow.toString(),
		];
		if (
			await this.#context.counter.increment(counterKey, 1, counterInterval) >
				this.#context.config.auth.security.rateLimit.identificationCount
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

		const identificator = this.#context.config.auth.components.get(id);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const stateIdentity = isAuthenticationCeremonyStateIdentified(state)
			? await this.#context.identity.get(state.identity)
			: undefined;
		const identityComponent = stateIdentity?.components[step.id];

		const result = await identificator.verifyPrompt({
			context: this.#context,
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
