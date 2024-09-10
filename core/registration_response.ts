import { type TUnion, Type } from "@sinclair/typebox";
import { RegistrationStep } from "./registration_step.ts";
import { AuthenticationTokens } from "./authentication_tokens.ts";

export type RegistrationResponse = RegistrationStep | AuthenticationTokens;

export const RegistrationResponse: TUnion<[
	typeof RegistrationStep,
	typeof AuthenticationTokens,
]> = Type.Union([
	RegistrationStep,
	AuthenticationTokens,
], { $id: "RegistrationResponse" });
