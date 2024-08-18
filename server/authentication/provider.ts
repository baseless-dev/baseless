import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "../authentication/component.ts";
import { Notification, NotificationTransport } from "@baseless/core/notification";
import { AuthenticationContext } from "./types.ts";

/**
 * An Identity Component Provider.
 */
export interface IdentityComponentProvider {
	/**
	 * Build an {@link IdentityComponent} from a value.
	 * @param options
	 * @returns Partial {@link IdentityComponent}
	 */
	buildIdentityComponent: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}) => Promise<Omit<IdentityComponent, "identityId" | "componentId">>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for signing in.
	 * @param options
	 * @returns The sign in {@link AuthenticationComponentPrompt}.
	 */
	getSignInPrompt: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
	}) => Promise<AuthenticationComponentPrompt>;

	/**
	 * Send a sign in prompt.
	 * @param options
	 * @returns Whether the prompt was sent.
	 */
	sendSignInPrompt?: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		locale: string;
	}) => Promise<boolean>;

	/**
	 * Verify a sign in prompt.
	 * @param options
	 * @returns Whether the prompt was verified.
	 */
	verifySignInPrompt: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}) => Promise<boolean | Identity["identityId"]>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for setting up.
	 * @param options
	 * @returns The setup {@link AuthenticationComponentPrompt}.
	 */
	getSetupPrompt: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
	}) => Promise<AuthenticationComponentPrompt>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for validating.
	 * @param options
	 * @returns The validation {@link AuthenticationComponentPrompt}.
	 */
	getValidationPrompt?: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}) => Promise<AuthenticationComponentPrompt | undefined>;

	/**
	 * Send a validation prompt.
	 * @param options
	 * @returns Whether the prompt was sent.
	 */
	sendValidationPrompt?: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		locale: string;
		value: unknown;
	}) => Promise<boolean>;

	/**
	 * Verify a validation prompt.
	 * @param options
	 * @returns Whether the prompt was verified.
	 */
	verifyValidationPrompt?: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
		value: unknown;
	}) => Promise<boolean>;
}

export interface NotificationProvider {
	getNotificationTransports: (
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	) => Promise<NotificationTransport>;
	addTransportToIdentity: (
		identityId: Identity["identityId"],
		transport: NotificationTransport,
	) => Promise<boolean>;
	listTransportsForIdentity: (
		identityId: Identity["identityId"],
	) => Promise<NotificationTransport[]>;
	removeTransportFromIdentity: (
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	) => Promise<boolean>;
	sendNotification: (
		identityId: Identity["identityId"],
		notification: Notification,
	) => Promise<boolean>;
}
