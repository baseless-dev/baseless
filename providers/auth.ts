import type {
	AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentPrompt,
} from "../lib/authentication/types.ts";
import type { Identity, IdentityComponent } from "../lib/identity/types.ts";

export abstract class AuthenticationProvider {
	#id: string;
	constructor(id: string) {
		this.#id = id;
	}

	get id(): string {
		return this.#id;
	}

	abstract configureIdentityComponent(
		value: unknown,
	): Promise<Omit<IdentityComponent, "id">>;

	toCeremonyComponent(): AuthenticationCeremonyComponent {
		return this.signInPrompt();
	}

	abstract signInPrompt(): AuthenticationCeremonyComponentPrompt;
	sendSignInPrompt(_options: {
		locale: string;
		identityId?: Identity["id"];
		identityComponent?: IdentityComponent;
	}): Promise<void> {
		return Promise.resolve();
	}
	abstract verifySignInPrompt(
		options: {
			value: unknown;
			identityId?: Identity["id"];
			identityComponent?: IdentityComponent;
		},
	): Promise<boolean | Identity>;

	setupPrompt(): undefined | AuthenticationCeremonyComponentPrompt {
		return undefined;
	}

	async submitSetupPrompt(options: {
		value: unknown;
		identity: Identity;
	}): Promise<IdentityComponent> {
		return {
			...await this.configureIdentityComponent(options.value),
			id: this.id,
		};
	}

	validationPrompt(): undefined | AuthenticationCeremonyComponentPrompt {
		return undefined;
	}
	// deno-lint-ignore no-unused-vars
	sendValidationPrompt(options: {
		locale: string;
		identity: Identity;
	}): Promise<void> {
		return Promise.resolve();
	}
	// deno-lint-ignore no-unused-vars
	verifyValidationPrompt(options: {
		value: unknown;
		identity: Identity;
	}): Promise<boolean> {
		return Promise.resolve(false);
	}
}
