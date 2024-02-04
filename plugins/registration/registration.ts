import { Assert, type JWTPayload, jwtVerify, SignJWT } from "../../deps.ts";
import { AuthenticationMissingIdentificatorError } from "../../lib/authentication/errors.ts";
import { extract } from "../../lib/authentication/extract.ts";
import { getComponentAtPath } from "../../lib/authentication/get_component_at_path.ts";
import type {
	AuthenticationCeremonyComponent,
} from "../../lib/authentication/types.ts";
import { autoid } from "../../lib/autoid.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import {
	RegistrationSendValidationCodeError,
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
import { AuthenticationComponent } from "../../providers/auth_component.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { AuthenticationKeys } from "../authentication/mod.ts";

export default class RegistrationService {
	#logger = createLogger("registration-service");
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
		const ceremonyComponent = getComponentAtPath(this.#ceremony, choices);
		const lastComponent = state.components.at(-1);
		if (lastComponent && !lastComponent.confirmed) {
			const component = this.#components.find((c) => c.id === lastComponent.id);
			const nextComponent = this.getCeremony({
				...state,
				components: state.components.slice(0, -1),
			});
			if (
				!component || !component.validationCodePrompt ||
				nextComponent.done === true ||
				!("component" in nextComponent)
			) {
				throw new AuthenticationMissingIdentificatorError();
			}
			const currentComponent = nextComponent.component.kind === "choice"
				? nextComponent.component.components.find((c) =>
					c.kind === "prompt" && c.id === lastComponent.id
				)
				: nextComponent.component;
			const last = !ceremonyComponent || ceremonyComponent.kind !== "prompt"
				? false
				: getComponentAtPath(this.#ceremony, [
					...choices,
					lastComponent.id,
				])?.kind === "done";
			return {
				done: false,
				first: false,
				last,
				forComponent: currentComponent as any,
				validationComponent: {
					...component.validationCodePrompt(),
					id: "validation",
				},
			};
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
		if (nextComponent.done === true || "validationComponent" in nextComponent) {
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
		const identificator = this.#components.find((c) => c.id === id);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}
		const identityComponent: IdentityComponent = {
			id,
			...await identificator.initializeIdentityComponent({ value }),
		};

		state.components.push(identityComponent);

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
		if (
			nextComponent.done === true ||
			!("validationComponent" in nextComponent) ||
			nextComponent.forComponent.id !== id
		) {
			throw new RegistrationSendValidationCodeError();
		}
		const identificator = this.#components.find((c) => c.id === id);
		if (!identificator) {
			throw new AuthenticationMissingIdentificatorError();
		}
		if (!identificator.sendValidationCode) {
			return false;
		}
		await identificator.sendValidationCode({
			locale,
			identity: {
				id: state.identity,
				component: state.components.at(-1)!,
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
		if (
			nextComponent.done === true ||
			!("validationComponent" in nextComponent) ||
			nextComponent.forComponent.id !== id
		) {
			throw new RegistrationSendValidationCodeError();
		}
		const identificator = this.#components.find((c) => c.id === id);
		if (!identificator || !identificator.validateCode) {
			throw new AuthenticationMissingIdentificatorError();
		}
		const result = await identificator.validateCode({
			value,
			identity: {
				id: state.identity,
				component: state.components.at(-1)!,
			},
		});
		if (result === false) {
			throw new RegistrationSubmitValidationCodeError();
		}

		const identityComponent = {
			...state.components.find((c) => c.id === id)!,
			confirmed: true,
		};
		state.components.splice(
			state.components.findIndex((c) => c.id === id),
			1,
			identityComponent,
		);

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
