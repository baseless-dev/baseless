import { type TUnion, Type } from "@sinclair/typebox";
import { AuthenticationStep } from "./authentication_step.ts";
import { AuthenticationTokens } from "./authentication_tokens.ts";

export type AuthenticationResponse = AuthenticationStep | AuthenticationTokens;

export const AuthenticationResponse: TUnion<[
	typeof AuthenticationStep,
	typeof AuthenticationTokens,
]> = Type.Union([
	AuthenticationStep,
	AuthenticationTokens,
], { $id: "AuthenticationResponse" });
