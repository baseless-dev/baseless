import { AuthenticationStep } from "./authentication_step.ts";
import { AuthenticationTokens } from "./authentication_tokens.ts";
import * as z from "./schema.ts";

export type AuthenticationResponse = AuthenticationStep | AuthenticationTokens;
export const AuthenticationResponse = z.union([AuthenticationStep, AuthenticationTokens]).meta({ id: "AuthenticationResponse" });
