import { AuthenticationStep } from "./authentication_step.ts";
import { AuthenticationTokens } from "./authentication_tokens.ts";
import * as Type from "./schema.ts";

export type AuthenticationResponse = AuthenticationStep | AuthenticationTokens;
export const AuthenticationResponse = Type.Union([AuthenticationStep, AuthenticationTokens]);
