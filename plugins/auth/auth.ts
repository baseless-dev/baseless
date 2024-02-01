import {
	Assert,
	type JWTPayload,
	jwtVerify,
	type KeyLike,
	SignJWT,
	Value,
} from "../../deps.ts";
import {
	AuthenticationCeremonyComponentPromptError,
	AuthenticationCeremonyDoneError,
	AuthenticationInvalidStepError,
	AuthenticationMissingIdentificatorError,
	AuthenticationRateLimitedError,
} from "../../lib/auth/errors.ts";
import { extract } from "../../lib/auth/extract.ts";
import { getComponentAtPath } from "../../lib/auth/get_component_at_path.ts";
import type {
	AuthenticationCeremonyComponent,
	AuthenticationCeremonyResponse,
	AuthenticationCeremonyState,
	AuthenticationCeremonyStateSignIn,
	AuthenticationCeremonyStateSignUp,
	AuthenticationSignUpResponse,
} from "../../lib/auth/types.ts";
import type {
	AuthenticationCeremonyComponentPrompt,
} from "../../lib/auth/types.ts";
import {
	AuthenticationCeremonyStateSchema,
	AuthenticationCeremonyStateSignInSchema,
} from "../../lib/auth/types.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import { AuthenticationComponent } from "../../providers/auth_component.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { AuthenticationKeys } from "./mod.ts";

export class AuthenticationService {
	#logger = createLogger("auth-service");
	#ceremony: AuthenticationCeremonyComponent;
	#components: AuthenticationComponent[];
	#identityProvider: IdentityProvider;
	#counterProvider: CounterProvider;
	#keys: AuthenticationKeys;
	#rateLimit: {
		count: number;
		interval: number;
	};
	#sessionDuration: string;

	constructor(
		ceremony: AuthenticationCeremonyComponent,
		identityProvider: IdentityProvider,
		counterProvider: CounterProvider,
		keys: AuthenticationKeys,
		rateLimit?: {
			count: number;
			interval: number;
		},
		sessionDuration = "10m",
	) {
		this.#ceremony = ceremony;
		this.#components = extract(ceremony)
			.filter((c): c is AuthenticationComponent =>
				c instanceof AuthenticationComponent
			);
		this.#identityProvider = identityProvider;
		this.#counterProvider = counterProvider;
		this.#keys = keys;
		this.#rateLimit = rateLimit ?? { count: 5, interval: 1000 * 60 * 5 };
		this.#sessionDuration = sessionDuration;
	}

	async #encryptAuthenticationCeremonyState(
		state: AuthenticationCeremonyState,
	): Promise<string> {
		return await new SignJWT(state as unknown as JWTPayload)
			.setProtectedHeader({ alg: this.#keys.algo })
			.setIssuedAt()
			.setExpirationTime(this.#sessionDuration)
			.sign(this.#keys.privateKey);
	}

	async #decryptAuthenticationCeremonyState(
		encryptedState: string,
	): Promise<AuthenticationCeremonyState> {
		const { payload } = await jwtVerify(encryptedState, this.#keys.publicKey);
		Assert(AuthenticationCeremonyStateSchema, payload);
		return payload;
	}

	#getCeremony(): AuthenticationCeremonyResponse;
	#getCeremony(
		encryptedState: string,
		state: AuthenticationCeremonyState,
	): AuthenticationCeremonyResponse;
	#getCeremony(
		encryptedState?: string,
		state?: AuthenticationCeremonyState,
	): AuthenticationCeremonyResponse {
		const choices = Value.Check(AuthenticationCeremonyStateSignInSchema, state)
			? state.choices
			: state?.components.map((c) => c.id) ?? [];
		const result = getComponentAtPath(this.#ceremony, choices);
		if (!result) {
			throw new AuthenticationCeremonyDoneError();
		}
		if (result.kind === "done") {
			if (state?.kind === "signin") {
				return { done: true, identityId: state.identity };
			}
			return { done: true };
		}
		const last = result.kind === "choice"
			? false
			: getComponentAtPath(this.#ceremony, [
				...choices,
				result.id,
			])?.kind === "done";
		const first = choices.length === 0;
		if (first) {
			return { done: false, component: result, first, last };
		}
		return {
			done: false,
			encryptedState: encryptedState ?? "",
			component: result,
			first,
			last,
		};
	}

	async getCeremony(
		encryptedState?: string,
	): Promise<AuthenticationCeremonyResponse> {
		if (encryptedState) {
			const state = await this.#decryptAuthenticationCeremonyState(
				encryptedState,
			);
			return this.#getCeremony(encryptedState, state);
		}
		return this.#getCeremony();
	}

	async submitSignInPrompt(
		encryptedState: string | undefined,
		id: string,
		value: unknown,
		subject: string,
	): Promise<AuthenticationCeremonyResponse> {
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
		const state = await this.#decryptAuthenticationCeremonyState(
			encryptedState ?? "",
		).catch((_) => ({
			kind: "signin" as const,
			choices: [],
			identity: undefined,
		}));
		if (state.kind !== "signin") {
			throw new AuthenticationInvalidStepError();
		}
		const authCeremony = encryptedState
			? await this.#getCeremony(encryptedState, state)
			: this.#getCeremony();
		if (authCeremony.done === false && "component" in authCeremony) {
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
				identity: identity.id,
				choices: [...state.choices, id],
			};
			const newEncryptedState = await this.#encryptAuthenticationCeremonyState(
				newState,
			);
			const newResult = await this.#getCeremony(newEncryptedState, newState);
			return newResult;
		} else {
			throw new AuthenticationCeremonyDoneError();
		}
	}

	async submitSignUpPrompt(
		encryptedState: string | undefined,
		id: string,
		value: unknown,
		subject: string,
	): Promise<AuthenticationSignUpResponse> {
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
		const state = await this.#decryptAuthenticationCeremonyState(
			encryptedState ?? "",
		).catch((_) => ({
			kind: "signup" as const,
			components: [] as IdentityComponent[],
		}));
		if (state.kind !== "signup") {
			throw new AuthenticationInvalidStepError();
		}
		const authCeremony = encryptedState
			? await this.#getCeremony(encryptedState, state)
			: this.#getCeremony();
		if (authCeremony.done === false && "component" in authCeremony) {
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
			const meta = identificator.getIdentityComponentMeta
				? await identificator.getIdentityComponentMeta({ value })
				: { meta: {} };
			const newState = {
				...state,
				components: [...state.components, {
					id,
					confirmed: false,
					...meta,
				}],
			};
			const newEncryptedState = await this.#encryptAuthenticationCeremonyState(
				newState,
			);
			const newResult = await this.#getCeremony(newEncryptedState, newState);
			if (newResult.done === true) {
				return { done: true, components: newState.components };
			}
			return newResult;
		} else {
			throw new AuthenticationCeremonyDoneError();
		}
	}
}
