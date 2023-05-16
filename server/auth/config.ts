import { AuthenticationChallenger } from "../../common/auth/challenger.ts";
import { AuthenticationIdenticator } from "../../common/auth/identicator.ts";
import {
	assertAuthenticationCeremonyComponent,
	AuthenticationCeremonyComponent,
} from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationConfiguration,
	AuthenticationHandler,
	AuthenticationKeys,
} from "../../common/server/config/auth.ts";
import { extract } from "../../common/auth/ceremony/component/extract.ts";

export class AuthenticationConfigurationBuilder {
	#enabled = false;
	#securityKeys?: AuthenticationKeys;
	#securitySalt?: string;
	#ceremony?: AuthenticationCeremonyComponent;
	#components = new Set<AuthenticationCeremonyComponent>();
	#onCreateIdentityHandler?: AuthenticationHandler;
	#onUpdateIdentityHandler?: AuthenticationHandler;
	#onDeleteIdentityHandler?: AuthenticationHandler;
	#rateLimit?: {
		identificationCount: number;
		identificationInterval: number;
		challengeCount: number;
		challengeInterval: number;
		confirmVerificationCodeCount: number;
		confirmVerificationCodeInterval: number;
	};

	public setEnabled(enabled: boolean) {
		this.#enabled = enabled;
		return this;
	}

	/**
	 * Defines the authentication keys and algorith
	 * @param keys The keys
	 * @returns The builder
	 */
	public setSecurityKeys(keys: AuthenticationKeys) {
		this.#securityKeys = keys;
		return this;
	}

	/**
	 * Defines the salt
	 * @param keys The salt
	 * @returns The builder
	 */
	public setSecuritySalt(salt: string) {
		this.#securitySalt = salt;
		return this;
	}

	public setRateLimit(limits: {
		identificationCount: number;
		identificationInterval: number;
		challengeCount: number;
		challengeInterval: number;
		confirmVerificationCodeCount: number;
		confirmVerificationCodeInterval: number;
	}) {
		this.#rateLimit = {
			identificationCount: limits.identificationCount,
			identificationInterval: limits.identificationInterval,
			challengeCount: limits.challengeCount,
			challengeInterval: limits.challengeInterval,
			confirmVerificationCodeCount: limits.confirmVerificationCodeCount,
			confirmVerificationCodeInterval: limits.confirmVerificationCodeInterval,
		};
		return this;
	}

	/**
	 * Defines the authentication methods and their login methods
	 * @param component The allowed authentication methods
	 * @returns The builder
	 */
	public setCeremony(component: AuthenticationCeremonyComponent) {
		assertAuthenticationCeremonyComponent(component);
		this.#ceremony = component;
		return this;
	}

	/**
	 * Defines an authentication ceremony component
	 * @param component The authentication ceremony component
	 * @returns The builder
	 */
	public addCeremonyComponent(component: AuthenticationCeremonyComponent) {
		assertAuthenticationCeremonyComponent(component);
		this.#components.add(component);
		return this;
	}

	/**
	 * Defines a callback to be triggered when a new {@see Identity} is created
	 * @param handler The callback
	 * @returns The builder
	 */
	public onCreateIdentity(handler: AuthenticationHandler) {
		this.#onCreateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is updated
	 * @param handler The callback
	 * @returns The builder
	 */
	public onUpdateIdentity(handler: AuthenticationHandler) {
		this.#onUpdateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is delete
	 * @param handler The callback
	 * @returns The builder
	 */
	public onDeleteIdentity(handler: AuthenticationHandler) {
		this.#onDeleteIdentityHandler = handler;
		return this;
	}

	/**
	 * Finalize the {@see AuthConfiguration}
	 * @returns The finalized {@see AuthConfiguration} object
	 */
	public build(): AuthenticationConfiguration {
		if (!this.#securityKeys) {
			throw new Error(`Authentication keys are needed.`);
		}
		if (!this.#ceremony) {
			throw new Error(`Authentication flow is needed.`);
		}
		if (!this.#securitySalt) {
			throw new Error(`Authentication salt is needed.`);
		}
		const ceremonyComponents = extract(this.#ceremony);
		ceremonyComponents.push(...this.#components);
		const identificatorCompoenents = ceremonyComponents.filter((
			component,
		): component is AuthenticationIdenticator =>
			component instanceof AuthenticationIdenticator
		);
		const challengerComponents = ceremonyComponents.filter((
			component,
		): component is AuthenticationChallenger =>
			component instanceof AuthenticationChallenger
		);
		return {
			enabled: this.#enabled,
			security: {
				keys: this.#securityKeys,
				salt: this.#securitySalt,
				rateLimit: {
					identificationCount: 100,
					identificationInterval: 60,
					challengeCount: 5,
					challengeInterval: 60,
					confirmVerificationCodeCount: 5,
					confirmVerificationCodeInterval: 60,
					...this.#rateLimit,
				},
			},
			ceremony: this.#ceremony,
			identificators: new Map(identificatorCompoenents.map((c) => [c.kind, c])),
			challengers: new Map(challengerComponents.map((c) => [c.kind, c])),
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
		};
	}
}

export class AuthenticationMissingIdentificatorError extends Error {}
export class AuthenticationMissingChallengerError extends Error {}
