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
	AuthenticationMissingIdentificatorError,
	AuthenticationRateLimitedError,
	AuthenticationSendPromptError,
	AuthenticationSubmitPromptError,
} from "../../lib/authentication/errors.ts";
import { extract } from "../../lib/authentication/extract.ts";
import { getComponentAtPath } from "../../lib/authentication/get_component_at_path.ts";
import type {
	AuthenticationCeremonyComponent,
	AuthenticationCeremonyState,
	AuthenticationSendPromptResult,
	AuthenticationState,
} from "../../lib/authentication/types.ts";
import type {
	AuthenticationCeremonyComponentPrompt,
} from "../../lib/authentication/types.ts";
import { AuthenticationStateSchema } from "../../lib/authentication/types.ts";
import type { Identity } from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import { AuthenticationComponent } from "../../providers/auth_component.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { AuthenticationKeys } from "./mod.ts";

export default class AuthenticationService {
	#logger = createLogger("auth-service");
	#ceremony: AuthenticationCeremonyComponent;
	#components: AuthenticationComponent[];
	#identityProvider: IdentityProvider;
	#keys: AuthenticationKeys;
	#rateLimit: {
		count: number;
		interval: number;
	};
	#sessionDuration: string;

	constructor(
		ceremony: AuthenticationCeremonyComponent,
		identityProvider: IdentityProvider,
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

	async getCeremony(
		encryptedState?: string,
	): Promise<AuthenticationCeremonyState> {
		const state = encryptedState
			? await this.decryptAuthenticationState(encryptedState)
			: undefined;
		const choices = state?.choices ?? [];
		const ceremonyComponent = getComponentAtPath(this.#ceremony, choices);
		if (!ceremonyComponent || ceremonyComponent.kind === "done") {
			return { done: true };
		}
		const last = ceremonyComponent.kind === "choice"
			? false
			: getComponentAtPath(this.#ceremony, [
				...choices,
				ceremonyComponent.id,
			])?.kind === "done";
		const first = choices.length === 0;
		return {
			done: false,
			component: ceremonyComponent,
			first,
			last,
			state: encryptedState,
		};
	}

	async submitPrompt(
		id: string,
		value: unknown,
		encryptedState?: string,
	): Promise<AuthenticationCeremonyState> {
		const state = encryptedState
			? await this.decryptAuthenticationState(encryptedState)
			: undefined;
		const nextComponent = await this.getCeremony(encryptedState);
		if (nextComponent.done === true) {
			return { done: true };
		}
		const currentComponent = nextComponent.component.kind === "choice"
			? nextComponent.component.components.find((c) =>
				c.kind === "prompt" && c.id === id
			)
			: nextComponent.component;

		if (!currentComponent || currentComponent.kind === "done") {
			return { done: true };
		}
		const identificator = this.#components.find((c) => c.id === id);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}
		let identity = state?.identity
			? await this.#identityProvider.get(state.identity)
			: undefined;
		const result = await identificator.verifyPrompt({
			value,
			identity: identity
				? {
					id: identity.id,
					component: identity.components[id],
				}
				: undefined,
		});
		// Identificator returned an identity, if state had previously identify an identity, it must be the same
		if (
			typeof result === "object" && (!identity || result.id === identity.id)
		) {
			identity = result;
		} // Identificator validated
		else if (result === false) {
			throw new AuthenticationSubmitPromptError();
		}
		const newState = {
			kind: "signin" as const,
			identity: identity?.id,
			choices: [...state?.choices ?? [], id],
		};
		const newEncryptedState = await this.encryptAuthenticationState(newState);
		return this.getCeremony(newEncryptedState);
	}

	async sendPrompt(
		id: string,
		locale: string,
		encryptedState?: string,
	): Promise<AuthenticationSendPromptResult> {
		const state = encryptedState
			? await this.decryptAuthenticationState(encryptedState)
			: undefined;
		if (!state?.identity) {
			throw new AuthenticationSendPromptError();
		}
		const nextComponent = await this.getCeremony(encryptedState);
		if (nextComponent.done === true) {
			return { sent: false };
		}
		const currentComponent = nextComponent.component.kind === "choice"
			? nextComponent.component.components.find((c) =>
				c.kind === "prompt" && c.id === id
			)
			: nextComponent.component;

		if (
			!currentComponent || currentComponent.kind === "done" ||
			currentComponent.id !== id
		) {
			throw new AuthenticationSendPromptError();
		}
		const identificator = this.#components.find((c) => c.id === id);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}
		if (identificator.sendPrompt) {
			const identity = await this.#identityProvider.get(state.identity);
			if (!(id in identity.components)) {
				throw new AuthenticationSendPromptError();
			}
			await identificator.sendPrompt({
				locale,
				identity: {
					id: identity.id,
					component: identity.components[id],
				},
			});
			return { sent: true };
		}
		return { sent: false };
	}
}
