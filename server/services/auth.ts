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
	type NonSequenceAuthenticationCeremonyComponent,
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
				NonSequenceAuthenticationCeremonyComponent,
				AuthenticationCeremonyComponentConditional
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
			NonSequenceAuthenticationCeremonyComponent,
			AuthenticationCeremonyComponentConditional
		>;
		if (isAuthenticationCeremonyComponentDone(result)) {
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
		identification: string,
		subject: string,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				NonSequenceAuthenticationCeremonyComponent,
				AuthenticationCeremonyComponentConditional
			>
		>
	> {
		const counterInterval =
			this.#context.config.auth.security.rateLimit.identificationInterval *
			1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
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

		const identityIdentification = await this.#context.identity
			.matchIdentification(type, identification);
		if (!identityIdentification.confirmed) {
			throw new AuthenticationIdentityIdentificationNotConfirmedError();
		}

		const identifyResult = await identificator.identify({
			context: this.#context,
			identityIdentification,
			identification,
		});
		if (identifyResult instanceof URL) {
			throw "Not Implemented";
			//return { done: false, redirect: identifyResult };
		}
		const newState = {
			choices: [...state.choices, type],
			identity: identityIdentification.identityId,
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
		challenge: string,
		subject: string,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				NonSequenceAuthenticationCeremonyComponent,
				AuthenticationCeremonyComponentConditional
			>
		>
	> {
		assertAuthenticationCeremonyStateIdentified(state);

		const counterInterval =
			this.#context.config.auth.security.rateLimit.identificationInterval;
		const counterLimit =
			this.#context.config.auth.security.rateLimit.identificationCount;
		const slidingWindow = Math.round(Date.now() / counterInterval * 1000);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
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

		const identityChallenge = await this.#context.identity.getChallenge(
			state.identity,
			step.id,
		);
		if (!identityChallenge.confirmed) {
			throw new AuthenticationIdentityChallengeNotConfirmedError();
		}

		if (
			!await challenger.verify({
				context: this.#context,
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
