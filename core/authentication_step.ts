import { type TObject, type TString, Type } from "@sinclair/typebox";
import { AuthenticationCeremony } from "./authentication_ceremony.ts";
import { AuthenticationComponent } from "./authentication_component.ts";

export interface AuthenticationStep {
	state: string;
	ceremony: AuthenticationCeremony;
	current: AuthenticationComponent;
}

export const AuthenticationStep: TObject<{
	state: TString;
	ceremony: typeof AuthenticationCeremony;
	current: typeof AuthenticationComponent;
}> = Type.Object({
	state: Type.String(),
	ceremony: AuthenticationCeremony,
	current: AuthenticationComponent,
}, { $id: "AuthenticationCeremonyStep" });
