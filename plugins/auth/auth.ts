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
	AuthenticationSignInState,
	AuthenticationSignUpResponse,
	AuthenticationSignUpState,
	AuthenticationState,
} from "../../lib/auth/types.ts";
import type {
	AuthenticationCeremonyComponentPrompt,
} from "../../lib/auth/types.ts";
import {
	AuthenticationSignInStateSchema,
	AuthenticationStateSchema,
} from "../../lib/auth/types.ts";
import { autoid } from "../../lib/autoid.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import { AuthenticationComponent } from "../../providers/auth_component.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { AuthenticationKeys } from "./mod.ts";

export default class AuthenticationService {
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

	async encryptAuthenticationState(
		state: AuthenticationState,
	): Promise<string> {
		return await new SignJWT(state as unknown as JWTPayload)
			.setProtectedHeader({ alg: this.#keys.algo })
			.setIssuedAt()
			.setExpirationTime(this.#sessionDuration)
			.sign(this.#keys.privateKey);
	}

	async decryptAuthenticationState(
		encryptedState: string,
	): Promise<AuthenticationState> {
		const { payload } = await jwtVerify(encryptedState, this.#keys.publicKey);
		Assert(AuthenticationStateSchema, payload);
		return payload;
	}

	getSignInCeremony(
		state?: AuthenticationSignInState,
	): AuthenticationCeremonyResponse {
		const choices = state?.choices ?? [];
		const result = getComponentAtPath(this.#ceremony, choices);
		if (!result || result.kind === "done") {
			return { done: true };
		}
		const last = result.kind === "choice"
			? false
			: getComponentAtPath(this.#ceremony, [
				...choices,
				result.id,
			])?.kind === "done";
		const first = choices.length === 0;
		return {
			done: false,
			component: result,
			first,
			last,
		};
	}

	getSignUpCeremony(
		state?: AuthenticationSignUpState,
	): AuthenticationCeremonyResponse {
		const lastComponent = state?.components.at(-1);
		if (lastComponent && lastComponent.confirmed === false) {
			const component = this.#components.find((c) => c.id === lastComponent.id);
			if (!component || !component.validationCodePrompt) {
				throw "TODO!";
			}
			return {
				done: false,
				component: { ...component.validationCodePrompt(), id: "validation" },
				first: false,
				last: false,
			};
		}
		const choices = state?.components.map((c) => c.id) ?? [];
		const result = getComponentAtPath(this.#ceremony, choices);
		if (!result || result.kind === "done") {
			return { done: true };
		}
		const last = result.kind === "choice"
			? false
			: getComponentAtPath(this.#ceremony, [
				...choices,
				result.id,
			])?.kind === "done";
		const first = choices.length === 0;
		return {
			done: false,
			component: result,
			first,
			last,
		};
	}

	// async submitSignInPrompt(
	// 	id: string,
	// 	value: unknown,
	// 	encryptedState?: string,
	// ): Promise<AuthenticationSignInResponse> {
	// 	throw "TODO!";
	// }

	async submitSignUpPrompt(
		id: string,
		value: unknown,
		state?: AuthenticationSignUpState,
	): Promise<AuthenticationSignUpResponse> {
		state ??= { kind: "signup" as const, components: [] };
		const signUpCeremony = this.getSignUpCeremony(state);
		if (signUpCeremony.done) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = signUpCeremony.component.kind === "choice"
			? signUpCeremony.component.components.find((
				s,
			): s is AuthenticationCeremonyComponentPrompt =>
				s.kind === "prompt" && s.id === id
			)
			: signUpCeremony.component;
		if (!step || step.kind === "done") {
			throw new AuthenticationInvalidStepError();
		}
		const validating = id === "validation";
		if (id === "validation") {
			id = state.components.at(-1)!.id;
		}
		const identificator = this.#components.find((comp) => comp.id === id);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}
		if (validating) {
			if (!identificator.validateCode || !state.identity) {
				throw "FIXME!";
			}
			const valid = await identificator.validateCode({
				value,
				identity: {
					id: state.identity,
					component: { id: "validation", confirmed: false, meta: {} },
				},
			});
			throw "TODO!";
		} else {
			const identityComponent = {
				id,
				...await identificator.initializeIdentityComponent({ value }),
			};
			const newState = {
				identity: autoid("tid-"),
				...state,
				components: [
					...state.components,
					identityComponent,
				],
			};
			const encryptedState = await this.encryptAuthenticationState(newState);
			const newResult = this.getSignUpCeremony(newState);
			return {
				state: encryptedState,
				response: newResult,
			};
		}
	}

	async sendSignUpValidationCode(
		id: string,
		state: AuthenticationSignUpState,
	): Promise<void> {
		const signUpCeremony = this.getSignUpCeremony(state);
		if (signUpCeremony.done) {
			throw new AuthenticationCeremonyDoneError();
		}
		const step = signUpCeremony.component.kind === "choice"
			? signUpCeremony.component.components.find((
				s,
			): s is AuthenticationCeremonyComponentPrompt =>
				s.kind === "prompt" && s.id === id
			)
			: signUpCeremony.component;
		if (!step || step.kind === "done") {
			throw new AuthenticationInvalidStepError();
		}
		throw "TODO!";
	}
}
