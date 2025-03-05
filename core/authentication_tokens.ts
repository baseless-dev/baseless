import * as Type from "./schema.ts";

export interface AuthenticationTokens {
	accessToken: string;
	idToken: string;
	refreshToken?: string;
}

export const AuthenticationTokens: Type.TObject<{
	accessToken: Type.TString;
	idToken: Type.TString;
	refreshToken: Type.TString;
}, ["accessToken", "idToken"]> = Type.Object({
	accessToken: Type.String(),
	idToken: Type.String(),
	refreshToken: Type.String(),
}, ["accessToken", "idToken"]);
