import { AuthenticationStep } from "./authentication_step.ts";
import { AuthenticationTokens } from "./authentication_tokens.ts";
import * as z from "./schema.ts";

/**
 * The result of an authentication ceremony step — either a
 * {@link AuthenticationStep} requesting more input, or
 * {@link AuthenticationTokens} on successful completion.
 */
export type AuthenticationResponse = AuthenticationStep | AuthenticationTokens;

/** Zod schema for {@link AuthenticationResponse}. */
export const AuthenticationResponse = z.union([AuthenticationStep, AuthenticationTokens]).meta({ id: "AuthenticationResponse" });
