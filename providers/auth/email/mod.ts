import type { AuthenticationCeremonyComponentPrompt } from "../../../lib/authentication/types.ts";
import { IdentityNotFoundError } from "../../../lib/identity/errors.ts";
import type {
	Identity,
	IdentityComponent,
} from "../../../lib/identity/types.ts";
import { otp } from "../../../lib/otp.ts";
import { AuthenticationProvider } from "../provider.ts";
import type { IdentityProvider } from "../../identity/provider.ts";
import type { KVProvider } from "../../kv/provider.ts";
import type { NotificationProvider } from "../../notification/provider.ts";
import { NotificationSendError } from "../../../lib/notification/errors.ts";

export default class EmailAuthenticationProvider
	extends AuthenticationProvider {
	#identityProvider: IdentityProvider;
	#kvProvider: KVProvider;
	#notificationProvider: NotificationProvider;

	constructor(
		id: string,
		identityProvider: IdentityProvider,
		kvProvider: KVProvider,
		notificationProvider: NotificationProvider,
	) {
		super(id);
		this.#identityProvider = identityProvider;
		this.#kvProvider = kvProvider;
		this.#notificationProvider = notificationProvider;
	}

	configureIdentityComponent(
		value: unknown,
	): Promise<Omit<IdentityComponent, "id">> {
		return Promise.resolve({
			identification: `${value}`,
			meta: {},
			confirmed: false,
		});
	}

	signInPrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "email",
			options: {},
		};
	}

	async verifySignInPrompt(
		options: {
			value: unknown;
			identityId: Identity["id"];
			identityComponent: IdentityComponent;
		},
	): Promise<boolean | Identity> {
		if (typeof options.value !== "string") {
			throw new IdentityNotFoundError();
		}
		const identity = await this.#identityProvider.getByIdentification(
			this.id,
			options.value,
		);
		if (identity.components.find((c) => c.id === this.id)?.confirmed) {
			return identity;
		}
		return false;
	}

	setupPrompt(): undefined | AuthenticationCeremonyComponentPrompt {
		return this.signInPrompt();
	}

	validationPrompt(): undefined | AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "otp",
			options: {
				digits: 8,
			},
		};
	}

	async sendValidationPrompt({ identity }: {
		locale: string;
		identity: Identity;
	}): Promise<void> {
		const identityComponent = identity.components.find((c) => c.id === this.id);
		if (!identityComponent) {
			throw new NotificationSendError();
		}
		const code = otp({ digits: 8 });
		await this.#kvProvider.put(["email-validation-code", identity.id], code, {
			expiration: 60 * 1000 * 5,
		});
		// TODO template?
		await this.#notificationProvider.send(identityComponent.identification, {
			subject: "Your verification code",
			content: {
				"text/x-otp-code": `${code}`,
				"text/plain": `Your verification code is ${code}`,
				"text/html": `Your verification code is <strong>${code}</strong>`,
			},
		});
	}

	async verifyValidationPrompt({ identity, value }: {
		value: unknown;
		identity: Identity;
	}): Promise<boolean> {
		const code = await this.#kvProvider.get(
			["email-validation-code", identity.id],
		);
		return code.value === `${value}`;
	}
}
