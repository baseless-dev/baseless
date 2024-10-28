import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import { AuthenticationContext } from "./types.ts";

/**
 * An Identity Component Provider.
 */
export interface IdentityComponentProvider {
	/**
	 * Check if a sign in prompt is required.
	 * @param options
	 * @returns Whether a sign in prompt is required.
	 */
	skipSignInPrompt?: (options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
	}) => Promise<boolean>;

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
	}) => Promise<AuthenticationComponentPrompt>;

	/**
	 * Build an {@link IdentityComponent} from a value.
	 * @param options
	 * @returns Partial {@link IdentityComponent}
	 */
	setupIdentityComponent: (options: {
		componentId: string;
		context: AuthenticationContext;
		value: unknown;
	}) => Promise<Omit<IdentityComponent, "identityId" | "componentId">>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for validating.
	 * @param options
	 * @returns The validation {@link AuthenticationComponentPrompt}.
	 */
	getValidationPrompt?: (options: {
		componentId: string;
		context: AuthenticationContext;
	}) => Promise<AuthenticationComponentPrompt>;

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
