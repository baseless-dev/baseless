import { type JWTPayload, jwtVerify, KeyLike, SignJWT } from "npm:jose@5.2.0";
import { Assert } from "../../lib/typebox.ts";
import {
	AuthenticationMissingIdentificatorError,
	AuthenticationSendPromptError,
	AuthenticationSubmitPromptError,
} from "../../lib/authentication/errors.ts";
import { getComponentAtPath } from "../../lib/authentication/get_component_at_path.ts";
import type {
	AuthenticationCeremonyComponent,
	AuthenticationCeremonyState,
	AuthenticationState,
} from "../../lib/authentication/types.ts";
import { AuthenticationStateSchema } from "../../lib/authentication/types.ts";
import type { Identity } from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import type { AuthenticationProvider } from "../../providers/auth/provider.ts";
import type { IdentityProvider } from "../../providers/identity/provider.ts";

export default class AuthenticationService {
	#logger = createLogger("authentication-service");
	#ceremony: AuthenticationCeremonyComponent;
	#providers: AuthenticationProvider[];
	#identityProvider: IdentityProvider;
	#keys: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	#rateLimit: {
		count: number;
		interval: number;
	};
	#sessionDuration: string;

	constructor(
		providers: AuthenticationProvider[],
		ceremony: AuthenticationCeremonyComponent,
		identityProvider: IdentityProvider,
		keys: {
			algo: string;
			privateKey: KeyLike;
			publicKey: KeyLike;
		},
		rateLimit?: {
			count: number;
			interval: number;
		},
		sessionDuration = "10m",
	) {
		this.#providers = providers;
		this.#ceremony = ceremony;
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

	getCeremony(
		state?: AuthenticationState,
	): AuthenticationCeremonyState {
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
		};
	}

	async submitPrompt(
		id: string,
		value: unknown,
		state?: AuthenticationState,
	): Promise<boolean | Identity> {
		const nextComponent = this.getCeremony(state);
		if (nextComponent.done === true) {
			throw new AuthenticationSubmitPromptError();
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
			throw new AuthenticationSubmitPromptError();
		}
		const provider = this.#providers.find((c) => c.id === id);
		if (!provider) {
			throw new AuthenticationMissingIdentificatorError();
		}
		const identity = state?.identity
			? await this.#identityProvider.get(state.identity)
			: undefined;
		const result = await provider.verifySignInPrompt({
			value,
			identityId: identity ? identity.id : undefined,
			identityComponent: identity
				? identity.components.find((c) => c.id === id)!
				: undefined,
		});
		return result;
	}

	async sendPrompt(
		id: string,
		locale: string,
		state?: AuthenticationState,
	): Promise<boolean> {
		const nextComponent = await this.getCeremony(state);
		if (nextComponent.done === true) {
			throw new AuthenticationSendPromptError();
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
		const provider = this.#providers.find((c) => c.id === id);
		if (!provider) {
			throw new AuthenticationMissingIdentificatorError();
		}
		const identity = state?.identity
			? await this.#identityProvider.get(state.identity)
			: undefined;
		const identityComponent = identity?.components.find((c) => c.id === id);
		if (
			!identity || !identityComponent || identityComponent.confirmed === false
		) {
			return false;
		}
		await provider.sendSignInPrompt({
			locale,
			identityId: identity.id,
			identityComponent,
		});
		return true;
	}
}
