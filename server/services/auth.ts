import { AutoId, isAutoId } from "../../shared/autoid.ts";
import { otp } from "../../shared/otp.ts";
import {
	AuthenticationMissingChallengerError,
	AuthenticationMissingIdentificatorError,
} from "../auth/config.ts";
import {
	assertAuthenticationStateIdentified,
	AuthenticationChoice,
	AuthenticationState,
	AuthenticationStep,
	flatten,
	getAuthenticationStepAtPath,
	isAuthenticationChoice,
	isAuthenticationState,
	isAuthenticationStep,
	simplify,
	simplifyWithContext,
} from "../auth/flow.ts";
import { Configuration } from "../config.ts";
import { Context } from "../context.ts";
import { CounterProvider } from "../providers/counter.ts";
import { IdentityProvider } from "../providers/identity.ts";
import { KVProvider } from "../providers/kv.ts";

export type GetStepYieldResult = {
	done: false;
	step: AuthenticationStep;
	first: boolean;
	last: boolean;
};
export type GetStepReturnResult = { done: true };
export type GetStepResult = GetStepYieldResult | GetStepReturnResult;

export function isGetStepYieldResult(
	value?: unknown,
): value is GetStepYieldResult {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "step" in value &&
		isAuthenticationStep(value.step) && "first" in value &&
		typeof value.first === "boolean" && "last" in value &&
		typeof value.last === "boolean";
}

export function assertGetStepYieldResult(
	value: unknown,
): asserts value is GetStepYieldResult {
	if (!isGetStepYieldResult(value)) {
		throw new InvalidGetStepYieldResultError();
	}
}

export class InvalidGetStepYieldResultError extends Error {}

export function isGetStepReturnResult(
	value?: unknown,
): value is GetStepReturnResult {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true;
}

export function assertGetStepReturnResult(
	value?: unknown,
): asserts value is GetStepReturnResult {
	if (!isGetStepReturnResult(value)) {
		throw new InvalidGetStepReturnResultError();
	}
}

export class InvalidGetStepReturnResultError extends Error {}

export function isGetStepResult(value?: unknown): value is GetStepResult {
	return isGetStepYieldResult(value) || isGetStepReturnResult(value);
}

export function assertGetStepResult(
	value?: unknown,
): asserts value is GetStepResult {
	if (!isGetStepResult(value)) {
		throw new InvalidGetStepResultError();
	}
}

export class InvalidGetStepResultError extends Error {}

export type AuthenticationResultDone = { done: true; identityId: AutoId };
export type AuthenticationResultError = { done: false; error: true };
export type AuthenticationResultRedirect = { done: false; redirect: URL };
export type AuthenticationResultState = GetStepYieldResult & {
	state: AuthenticationState;
};
export type AuthenticationResultEncryptedState = GetStepYieldResult & {
	encryptedState: string;
};

export type AuthenticationResult =
	| AuthenticationResultDone
	| AuthenticationResultError
	| AuthenticationResultRedirect
	| AuthenticationResultState;

export function isAuthenticationResultDone(
	value?: unknown,
): value is AuthenticationResultDone {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && "identityId" in value && isAutoId(value.identityId);
}

export function assertAuthenticationResultDone(
	value?: unknown,
): asserts value is AuthenticationResultDone {
	if (!isAuthenticationResultDone(value)) {
		throw new InvalidAuthenticationResultDoneError();
	}
}

export class InvalidAuthenticationResultDoneError extends Error {}

export function isAuthenticationResultError(
	value?: unknown,
): value is AuthenticationResultError {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "error" in value &&
		typeof value.error === "boolean";
}

export function assertAuthenticationResultError(
	value?: unknown,
): asserts value is AuthenticationResultError {
	if (!isAuthenticationResultError(value)) {
		throw new InvalidAuthenticationResultErrorError();
	}
}

export class InvalidAuthenticationResultErrorError extends Error {}

export function isAuthenticationResultRedirect(
	value?: unknown,
): value is AuthenticationResultRedirect {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "redirect" in value &&
		value.redirect instanceof URL;
}

export function assertAuthenticationResultRedirect(
	value?: unknown,
): asserts value is AuthenticationResultRedirect {
	if (!isAuthenticationResultRedirect(value)) {
		throw new InvalidAuthenticationResultRedirectError();
	}
}

export class InvalidAuthenticationResultRedirectError extends Error {}

export function isAuthenticationResultState(
	value?: unknown,
): value is AuthenticationResultState {
	return isGetStepYieldResult(value) && "state" in value &&
		isAuthenticationState(value.state);
}

export function assertAuthenticationResultState(
	value?: unknown,
): asserts value is AuthenticationResultState {
	if (!isAuthenticationResultState(value)) {
		throw new InvalidAuthenticationResultStateError();
	}
}

export class InvalidAuthenticationResultStateError extends Error {}

export function isAuthenticationResultEncryptedState(
	value?: unknown,
): value is AuthenticationResultEncryptedState {
	return isGetStepYieldResult(value) && "encryptedState" in value &&
		typeof value.encryptedState === "string";
}

export function assertAuthenticationResultEncryptedState(
	value?: unknown,
): asserts value is AuthenticationResultEncryptedState {
	if (!isAuthenticationResultEncryptedState(value)) {
		throw new InvalidAuthenticationResultEncryptedStateError();
	}
}

export class InvalidAuthenticationResultEncryptedStateError extends Error {}

export function isAuthenticationResult(
	value?: unknown,
): value is AuthenticationResult {
	return isAuthenticationResultDone(value) ||
		isAuthenticationResultError(value) ||
		isAuthenticationResultRedirect(value) || isAuthenticationResultState(value);
}

export function assertAuthenticationResult(
	value?: unknown,
): asserts value is AuthenticationResult {
	if (!isAuthenticationResult(value)) {
		throw new InvalidAuthenticationResultError();
	}
}

export class InvalidAuthenticationResultError extends Error {}

export class AuthenticationService {
	#configuration: Configuration;
	#identityProvider: IdentityProvider;
	#counterProvider: CounterProvider;
	#kvProvider: KVProvider;

	constructor(
		configuration: Configuration,
		identityProvider: IdentityProvider,
		counterProvider: CounterProvider,
		kvProvider: KVProvider,
	) {
		this.#configuration = configuration;
		this.#identityProvider = identityProvider;
		this.#counterProvider = counterProvider;
		this.#kvProvider = kvProvider;
	}

	async getStep(
		state?: AuthenticationState,
		context?: Context,
	): Promise<GetStepResult> {
		state ??= { choices: [] };
		const step = flatten(
			context
				? await simplifyWithContext(
					this.#configuration.auth.flow.step,
					context,
					state,
				)
				: simplify(this.#configuration.auth.flow.step),
		);
		const result = getAuthenticationStepAtPath(step, state.choices);
		if (result.done) {
			return { done: true };
		}
		const last = isAuthenticationChoice(result.step)
			? false
			: getAuthenticationStepAtPath(step, [...state.choices, result.step.type])
				.done;
		const first = state.choices.length === 0;
		return { done: false, step: result.step, first, last };
	}

	async submitIdentification(
		state: AuthenticationState,
		type: string,
		identification: string,
		subject: string,
	): Promise<AuthenticationResult> {
		const counterInterval =
			this.#configuration.auth.security.rateLimit.identificationInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
		if (
			await this.#counterProvider.increment(counterKey, 1, counterInterval) >
				this.#configuration.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}
		const result = await this.getStep(state);
		if (result.done) {
			throw new AuthenticationFlowDoneError();
		}
		const step = isAuthenticationChoice(result.step)
			? result.step.choices.find((s) => s.type === type)
			: result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const identificator = this.#configuration.auth.flow.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const identityIdentification = await this.#identityProvider
			.matchIdentification(type, identification);

		const identifyResult = await identificator.identify(
			identityIdentification,
			identification,
		);
		if (identifyResult instanceof URL) {
			return { done: false, redirect: identifyResult };
		}
		const newState = {
			choices: [...state.choices, type],
			identity: identityIdentification.identityId,
		};
		const newResult = await this.getStep(newState);
		if (newResult.done) {
			return { done: true, identityId: identityIdentification.identityId };
		} else {
			return {
				...await this.getStep(newState) as GetStepYieldResult,
				state: newState,
			};
		}
	}

	async submitChallenge(
		state: AuthenticationState,
		type: string,
		challenge: string,
		subject: string,
	): Promise<AuthenticationResult> {
		assertAuthenticationStateIdentified(state);

		const counterInterval =
			this.#configuration.auth.security.rateLimit.identificationInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey = `/auth/identification/${subject}/${slidingWindow}`;
		if (
			await this.#counterProvider.increment(counterKey, 1, counterInterval) >
				this.#configuration.auth.security.rateLimit.identificationCount
		) {
			throw new AuthenticationRateLimitedError();
		}

		const result = await this.getStep(state);
		if (result.done) {
			throw new AuthenticationFlowDoneError();
		}
		const step = isAuthenticationChoice(result.step)
			? result.step.choices.find((s) => s.type === type)
			: result.step;
		if (!step) {
			throw new AuthenticationInvalidStepError();
		}

		const challenger = this.#configuration.auth.flow.chalengers.get(step.type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}

		const identityChallenge = await this.#identityProvider.getChallenge(
			state.identity,
			step.type,
		);
		if (!identityChallenge) {
			throw new AuthenticationMissingChallengeError();
		}

		if (!await challenger.verify(identityChallenge, challenge)) {
			throw new AuthenticationChallengeFailedError();
		}

		const newState = {
			choices: [...state.choices, type],
			identity: state.identity,
		};
		const newResult = await this.getStep(newState);
		if (newResult.done) {
			return { done: true, identityId: state.identity };
		}
		return {
			...await this.getStep(newState) as GetStepYieldResult,
			state: newState,
		};
	}

	async sendIdentificationValidationCode(
		identityId: AutoId,
		type: string,
	) {
		const identificator = this.#configuration.auth.flow.identificators.get(
			type,
		);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}

		if (identificator.sendMessage) {
			if (identificator.sendInterval && identificator.sendCount) {
				const counterInterval = identificator.sendInterval * 1000;
				const slidingWindow = Math.round(Date.now() / counterInterval);
				const counterKey =
					`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
				if (
					await this.#counterProvider.increment(
						counterKey,
						1,
						identificator.sendInterval,
					) >
						identificator.sendCount
				) {
					throw new AuthenticationRateLimitedError();
				}
			}
			const code = otp({ digits: 6 });
			await this.#kvProvider.put(
				`/auth/validationcode/${identityId}/${type}`,
				code,
				{ expiration: 1000 * 60 * 5 },
			);

			const identityIdentifications = await this.#identityProvider
				.listIdentification(identityId);
			const identityIdentification = identityIdentifications.find((ii) =>
				ii.type === type
			);
			if (!identityIdentification) {
				throw new AuthenticationMissingIdentificationError();
			}
			await identificator.sendMessage(identityIdentification, { text: code });
		}
	}

	async confirmIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		code: string,
	) {
		const counterInterval = this.#configuration.auth.security.rateLimit
			.confirmVerificationCodeInterval * 1000;
		const slidingWindow = Math.round(Date.now() / counterInterval);
		const counterKey =
			`/auth/sendvalidationcode/${identityId}/${type}/${slidingWindow}`;
		if (
			await this.#counterProvider.increment(
				counterKey,
				1,
				this.#configuration.auth.security.rateLimit
					.confirmVerificationCodeInterval,
			) >
				this.#configuration.auth.security.rateLimit.confirmVerificationCodeCount
		) {
			throw new AuthenticationRateLimitedError();
		}

		const identityIdentifications = await this.#identityProvider
			.listIdentification(identityId);
		const identityIdentification = identityIdentifications.find((ii) =>
			ii.type === type
		);
		if (!identityIdentification) {
			throw new AuthenticationMissingIdentificationError();
		}

		const savedCode = await this.#kvProvider.get(
			`/auth/validationcode/${identityId}/${type}`,
		).catch((_) => undefined);
		if (!savedCode || savedCode.value !== code) {
			throw new AuthenticationConfirmValidationCodeError();
		}

		await this.#identityProvider.updateIdentification({
			...identityIdentification,
			verified: true,
		});
	}
}

export class AuthenticationFlowDoneError extends Error {}
export class AuthenticationInvalidStepError extends Error {}
export class AuthenticationRateLimitedError extends Error {}
export class AuthenticationMissingChallengeError extends Error {}
export class AuthenticationChallengeFailedError extends Error {}
export class AuthenticationMissingIdentificationError extends Error {}
export class AuthenticationSendValidationCodeError extends Error {}
export class AuthenticationConfirmValidationCodeError extends Error {}
