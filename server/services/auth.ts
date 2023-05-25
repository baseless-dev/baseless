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
import { isAuthenticationCeremonyResponseState } from "../../common/auth/ceremony/response/state.ts";
import {
	assertAuthenticationCeremonyStateIdentified,
	type AuthenticationCeremonyState,
	isAuthenticationCeremonyStateIdentified,
} from "../../common/auth/ceremony/state.ts";
import { isAuthenticationCeremonyComponentChoice } from "../../common/auth/ceremony/component/choice.ts";
import { flatten } from "../../common/auth/ceremony/component/flatten.ts";
import { getComponentAtPath } from "../../common/auth/ceremony/component/get_component_at_path.ts";
import { simplifyWithContext } from "../../common/auth/ceremony/component/simplify.ts";
import { createLogger } from "../../common/system/logger.ts";
import type { IContext } from "../../common/server/context.ts";
import type { IAuthenticationService } from "../../common/server/services/auth.ts";

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
	): Promise<AuthenticationCeremonyResponse> {
		state ??= { choices: [] };
		const step = flatten(
			await simplifyWithContext(
				this.#context.config.auth.ceremony,
				this.#context,
				state,
			),
		);
		const result = getComponentAtPath(step, state.choices);
		if (result.done) {
			if (isAuthenticationCeremonyStateIdentified(state)) {
				return { done: true, identityId: state.identity };
			}
			throw new AuthenticationCeremonyDoneError();
		}
		const last = isAuthenticationCeremonyComponentChoice(result.component)
			? false
			: getComponentAtPath(step, [...state.choices, result.component.kind])
				.done;
		const first = state.choices.length === 0;
		return { done: false, component: result.component, first, last, state };
	}

	async submitAuthenticationIdentification(
		state: AuthenticationCeremonyState,
		type: string,
		identification: string,
		subject: string,
	): Promise<AuthenticationCeremonyResponse> {
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
			? result.component.components.find((s) => s.kind === type)
			: result.component;
		if (!step) {
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
			return { done: false, redirect: identifyResult };
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
	): Promise<AuthenticationCeremonyResponse> {
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
			? result.component.components.find((s) => s.kind === type)
			: result.component;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const challenger = this.#context.config.auth.challengers.get(step.kind);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}

		const identityChallenge = await this.#context.identity.getChallenge(
			state.identity,
			step.kind,
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
