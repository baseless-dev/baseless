import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "../authentication/component.ts";
import { Notification, NotificationTransport } from "@baseless/core/notification";
import { AuthenticationContext } from "./application.ts";

/**
 * An Identity Component Provider.
 */
export abstract class IdentityComponentProvider {
	id: string;

	constructor(id: string) {
		this.id = id;
	}

	/**
	 * Build an {@link IdentityComponent} from a value.
	 * @param options
	 * @returns Partial {@link IdentityComponent}
	 */
	abstract buildIdentityComponent(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}): Promise<Omit<IdentityComponent, "identityId" | "componentId">>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for signing in.
	 * @param options
	 * @returns The sign in {@link AuthenticationComponentPrompt}.
	 */
	abstract getSignInPrompt(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
	}): Promise<AuthenticationComponentPrompt>;

	/**
	 * Send a sign in prompt.
	 * @param options
	 * @returns Whether the prompt was sent.
	 */
	sendSignInPrompt(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		locale: string;
	}): Promise<boolean> {
		return Promise.resolve(false);
	}

	/**
	 * Verify a sign in prompt.
	 * @param options
	 * @returns Whether the prompt was verified.
	 */
	abstract verifySignInPrompt(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}): Promise<boolean | Identity["identityId"]>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for setting up.
	 * @param options
	 * @returns The setup {@link AuthenticationComponentPrompt}.
	 */
	abstract getSetupPrompt(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
	}): Promise<AuthenticationComponentPrompt>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for validating.
	 * @param options
	 * @returns The validation {@link AuthenticationComponentPrompt}.
	 */
	getValidationPrompt(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}): Promise<AuthenticationComponentPrompt | undefined> {
		return Promise.resolve(undefined);
	}

	/**
	 * Send a validation prompt.
	 * @param options
	 * @returns Whether the prompt was sent.
	 */
	sendValidationPrompt(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		locale: string;
		value: unknown;
	}): Promise<boolean> {
		return Promise.resolve(false);
	}

	/**
	 * Verify a validation prompt.
	 * @param options
	 * @returns Whether the prompt was verified.
	 */
	verifyValidationPrompt(options: {
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}): Promise<boolean> {
		return Promise.resolve(false);
	}
}

export abstract class NotificationProvider {
	abstract getNotificationTransports(
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	): Promise<NotificationTransport>;
	abstract addTransportToIdentity(
		identityId: Identity["identityId"],
		transport: NotificationTransport,
	): Promise<boolean>;
	abstract listTransportsForIdentity(
		identityId: Identity["identityId"],
	): Promise<NotificationTransport[]>;
	abstract removeTransportFromIdentity(
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	): Promise<boolean>;
	abstract sendNotification(
		identityId: Identity["identityId"],
		notification: Notification,
	): Promise<boolean>;
}
