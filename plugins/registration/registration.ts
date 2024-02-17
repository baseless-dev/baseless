import { Assert, type JWTPayload, jwtVerify, SignJWT } from "../../deps.ts";
import { AuthenticationMissingIdentificatorError } from "../../lib/authentication/errors.ts";
import { getComponentAtPath } from "../../lib/authentication/get_component_at_path.ts";
import type {
	AuthenticationCeremonyComponent,
} from "../../lib/authentication/types.ts";
import { oneOf } from "../../lib/authentication/types.ts";
import { autoid } from "../../lib/autoid.ts";
import { createLogger } from "../../lib/logger.ts";
import {
	RegistrationSubmitPromptError,
	RegistrationSubmitValidationCodeError,
} from "../../lib/registration/errors.ts";
import {
	REGISTRATION_AUTOID_PREFIX,
	RegistrationCeremonyState,
	type RegistrationState,
	RegistrationStateSchema,
	RegistrationSubmitResult,
} from "../../lib/registration/types.ts";
import type { AuthenticationProvider } from "../../providers/auth.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { AuthenticationKeys } from "../authentication/mod.ts";

export default class RegistrationService {
	#logger = createLogger("registration-service");
	#ceremony: AuthenticationCeremonyComponent;
	#providers: AuthenticationProvider[];
	#identityProvider: IdentityProvider;
	#keys: AuthenticationKeys;
	#rateLimit: {
		count: number;
		interval: number;
	};
	#sessionDuration: string;

	constructor(
		providers: AuthenticationProvider[],
		ceremony: AuthenticationCeremonyComponent,
		identityProvider: IdentityProvider,
		keys: AuthenticationKeys,
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

	async encryptRegistrationState(
		state: RegistrationState,
	): Promise<string> {
		return await new SignJWT(state as unknown as JWTPayload)
			.setProtectedHeader({ alg: this.#keys.algo })
			.setIssuedAt()
			.setExpirationTime(this.#sessionDuration)
			.sign(this.#keys.privateKey);
	}

	async decryptRegistrationState(
		encryptedState: string,
	): Promise<RegistrationState> {
		const { payload } = await jwtVerify(encryptedState, this.#keys.publicKey);
		Assert(RegistrationStateSchema, payload);
		return payload;
	}

	getCeremony(
		state?: RegistrationState,
	): RegistrationCeremonyState {
		state ??= {
			identity: autoid(REGISTRATION_AUTOID_PREFIX),
			kind: "registration",
			components: [],
		};
		const choices = state.components.map((c) => c.id) ?? [];
		let ceremonyComponent = getComponentAtPath(this.#ceremony, choices);
		const lastComponent = state.components.at(-1);
		if (lastComponent && !lastComponent.confirmed) {
			const provider = this.#providers.find((c) => c.id === lastComponent.id);
			if (!provider) {
				throw new AuthenticationMissingIdentificatorError();
			}
			ceremonyComponent = provider.validationPrompt();
		} else if (ceremonyComponent) {
			if (ceremonyComponent.kind === "prompt") {
				const ceremonyComponentPrompt = ceremonyComponent;
				const provider = this.#providers.find((c) =>
					c.id === ceremonyComponentPrompt.id
				);
				if (!provider) {
					throw new AuthenticationMissingIdentificatorError();
				}
				ceremonyComponent = provider.setupPrompt();
			} else if (ceremonyComponent.kind === "choice") {
				const components = ceremonyComponent.components.map((component) => {
					const provider = this.#providers.find((c) => c.id === component.id);
					if (!provider) {
						throw new AuthenticationMissingIdentificatorError();
					}
					return provider.setupPrompt();
				});
				ceremonyComponent = oneOf(...components) as ReturnType<
					typeof getComponentAtPath
				>;
			}
		}
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
			first,
			last,
			component: ceremonyComponent,
		};
	}

	async submitPrompt(
		id: string,
		value: unknown,
		state?: RegistrationState,
	): Promise<RegistrationSubmitResult> {
		state ??= {
			identity: autoid(REGISTRATION_AUTOID_PREFIX),
			kind: "registration",
			components: [],
		};
		const nextComponent = this.getCeremony(state);
		if (nextComponent.done === true) {
			throw new RegistrationSubmitPromptError();
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
			throw new RegistrationSubmitPromptError();
		}
		const provider = this.#providers.find((c) => c.id === id);
		if (!provider) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const result = await provider.submitSetupPrompt({
			value,
			identity: {
				id: state.identity,
				components: state.components,
				meta: {},
			},
		});

		state.components.push(result);

		if (this.getCeremony(state).done === true) {
			return {
				kind: "identity",
				identity: await this.#identityProvider.create(
					{},
					state.components,
				),
			};
		}

		return state;
	}

	async sendValidationCode(
		id: string,
		locale: string,
		state?: RegistrationState,
	): Promise<boolean> {
		state ??= {
			identity: autoid(REGISTRATION_AUTOID_PREFIX),
			kind: "registration",
			components: [],
		};
		const nextComponent = this.getCeremony(state);
		if (nextComponent.done === true) {
			throw new RegistrationSubmitPromptError();
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
			throw new RegistrationSubmitPromptError();
		}
		const provider = this.#providers.find((c) => c.id === id);
		if (!provider) {
			throw new AuthenticationMissingIdentificatorError();
		}
		await provider.sendValidationPrompt({
			locale,
			identity: {
				id: state.identity,
				components: state.components,
				meta: {},
			},
		});
		return true;
	}

	async submitValidationCode(
		id: string,
		value: unknown,
		state?: RegistrationState,
	): Promise<RegistrationSubmitResult> {
		state ??= {
			identity: autoid(REGISTRATION_AUTOID_PREFIX),
			kind: "registration",
			components: [],
		};
		const nextComponent = this.getCeremony(state);
		if (nextComponent.done === true) {
			throw new RegistrationSubmitPromptError();
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
			throw new RegistrationSubmitPromptError();
		}
		const provider = this.#providers.find((c) => c.id === id);
		if (!provider) {
			throw new AuthenticationMissingIdentificatorError();
		}

		const identityComponent = state.components.find((c) => c.id === id);
		if (!identityComponent) {
			throw new RegistrationSubmitValidationCodeError();
		}

		const result = await provider.verifyValidationPrompt({
			value,
			identity: {
				id: state.identity,
				components: state.components,
				meta: {},
			},
		});

		if (!result) {
			throw new RegistrationSubmitValidationCodeError();
		}
		identityComponent.confirmed = true;
		if (this.getCeremony(state).done === true) {
			return {
				kind: "identity",
				identity: await this.#identityProvider.create(
					{},
					state.components,
				),
			};
		}

		return state;
	}
}
