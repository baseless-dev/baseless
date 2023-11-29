import {
	AuthenticationCeremonyComponentChallengeFailedError,
	AuthenticationCeremonyDoneError,
	AuthenticationIdentityChallengeNotConfirmedError,
	AuthenticationIdentityIdentificationNotConfirmedError,
	AuthenticationInvalidStepError,
	AuthenticationMissingChallengerError,
	AuthenticationMissingIdentificatorError,
	AuthenticationRateLimitedError,
} from "../../common/auth/errors.ts";
import type { AuthenticationCeremonyResponse } from "../../common/auth/ceremony/response.ts";
import {
	isAuthenticationCeremonyResponseDone,
	isAuthenticationCeremonyResponseState,
} from "../../common/auth/ceremony/response.ts";
import {
	assertAuthenticationCeremonyStateIdentified,
	type AuthenticationCeremonyState,
	isAuthenticationCeremonyStateIdentified,
} from "../../common/auth/ceremony/state.ts";
import {
	type AuthenticationCeremonyComponentChallenge,
	type AuthenticationCeremonyComponentConditional,
	type AuthenticationCeremonyComponentIdentification,
	isAuthenticationCeremonyComponentChallenge,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentDone,
	isAuthenticationCeremonyComponentIdentification,
} from "../../common/auth/ceremony/ceremony.ts";
import {
	getComponentAtPath,
} from "../../common/auth/ceremony/component/get_component_at_path.ts";
import { createLogger } from "../../common/system/logger.ts";
import type { IContext } from "../../common/server/context.ts";
import type { IAuthenticationService } from "../../common/server/services/auth.ts";
import { resolveConditional } from "../../common/auth/ceremony/component/resolve_conditional.ts";

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

	async submitAuthenticationIdentification(
		state: AuthenticationCeremonyState,
		type: string,
		identification: unknown,
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
		const result = await this.getAuthenticationCeremony(state);
		if (!isAuthenticationCeremonyResponseState(result)) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = isAuthenticationCeremonyComponentChoice(result.component)
			? result.component.components.find((
				s,
			): s is
				| AuthenticationCeremonyComponentIdentification
				| AuthenticationCeremonyComponentChallenge =>
				(isAuthenticationCeremonyComponentIdentification(s) ||
					isAuthenticationCeremonyComponentChallenge(s)) && s.id === type
			)
			: result.component;
		if (!step || isAuthenticationCeremonyComponentDone(step)) {
			throw new AuthenticationInvalidStepError();
		}

		const identificator = this.#context.config.auth.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const identity = await identificator.identify({
			context: this.#context,
			type,
			identification,
		});
		const newState = {
			choices: [...state.choices, type],
			identity: identity.id,
		};
		const newResult = await this.getAuthenticationCeremony(newState);
		return newResult;
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {AuthenticationInvalidStepError}
	 */
	async submitAuthenticationChallenge(
		state: AuthenticationCeremonyState,
		type: string,
		challenge: unknown,
		subject: string,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				ReturnType<typeof getComponentAtPath>,
				AuthenticationCeremonyComponentConditional | undefined
			>
		>
	> {
		assertAuthenticationCeremonyStateIdentified(state);

		const counterInterval =
			this.#context.config.auth.security.rateLimit.identificationInterval;
		const counterLimit =
			this.#context.config.auth.security.rateLimit.identificationCount;
		const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
		const counterKey = [
			"auth",
			"identification",
			subject,
			slidingWindow.toString(),
		];
		const counter = await this.#context.counter.increment(
			counterKey,
			1,
			counterInterval,
		);
		if (counter > counterLimit) {
			throw new AuthenticationRateLimitedError();
		}

		const result = await this.getAuthenticationCeremony(state);
		if (!isAuthenticationCeremonyResponseState(result)) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = isAuthenticationCeremonyComponentChoice(result.component)
			? result.component.components.find((
				s,
			): s is
				| AuthenticationCeremonyComponentIdentification
				| AuthenticationCeremonyComponentChallenge =>
				(isAuthenticationCeremonyComponentIdentification(s) ||
					isAuthenticationCeremonyComponentChallenge(s)) && s.id === type
			)
			: result.component;

		if (!step || isAuthenticationCeremonyComponentDone(step)) {
			throw new AuthenticationInvalidStepError();
		}

		const challenger = this.#context.config.auth.challengers.get(step.id);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}

		const identity = await this.#context.identity.get(state.identity);
		const identityChallenge = identity.challenges[step.id];
		// if (!identityChallenge.confirmed) {
		// 	throw new AuthenticationIdentityChallengeNotConfirmedError();
		// }

		if (
			!await challenger.verify({
				context: this.#context,
				identityId: identity.id,
				identityChallenge,
				challenge,
			})
		) {
			throw new AuthenticationCeremonyComponentChallengeFailedError();
		}

		const newState = {
			choices: [...state.choices, type],
			identity: state.identity,
		};
		const newResult = await this.getAuthenticationCeremony(newState);
		return newResult;
	}
}
