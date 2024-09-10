import { TObject, TOptional, TString, Type } from "@sinclair/typebox";

export interface AuthenticationTokens {
	access_token: string;
	id_token: string;
	refresh_token?: string;
}

export const AuthenticationTokens: TObject<{
	access_token: TString;
	id_token: TString;
	refresh_token: TOptional<TString>;
}> = Type.Object({
	access_token: Type.String(),
	id_token: Type.String(),
	refresh_token: Type.Optional(Type.String()),
}, { $id: "AuthenticationTokens" });

export function isAuthenticationTokens(value: unknown): value is AuthenticationTokens {
	return !!value && typeof value === "object" &&
		"access_token" in value && typeof value.access_token === "string" &&
		"id_token" in value && typeof value.id_token === "string" &&
		("refresh_token" in value ? typeof value.refresh_token === "string" : true);
}
