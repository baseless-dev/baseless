import { AuthenticationStep } from "./authentication_step.ts";
import { AuthenticationTokens } from "./authentication_tokens.ts";
import * as z from "./schema.ts";

/**
 * Successful completion result for a component modification ceremony.
 * Indicates which Ceremony Component was updated without issuing new tokens.
 */
export interface AuthenticationModificationResult {
	kind: "modification-complete";
	componentId: string;
}

/** Zod schema for {@link AuthenticationModificationResult}. */
export const AuthenticationModificationResult = z.strictObject({
	kind: z.literal("modification-complete"),
	componentId: z.string(),
}).meta({ id: "AuthenticationModificationResult" });

/**
 * The result of an authentication ceremony step — either a
 * {@link AuthenticationStep} requesting more input,
 * {@link AuthenticationTokens} on successful authentication or registration,
 * or an {@link AuthenticationModificationResult} on successful modification.
 */
export type AuthenticationResponse =
	| AuthenticationStep
	| AuthenticationTokens
	| AuthenticationModificationResult;

/** Zod schema for {@link AuthenticationResponse}. */
export const AuthenticationResponse = z.union([
	AuthenticationStep,
	AuthenticationTokens,
	AuthenticationModificationResult,
]).meta({ id: "AuthenticationResponse" });
