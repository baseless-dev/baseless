import { type TBoolean, type TObject, type TString, Type } from "@sinclair/typebox";
import { AuthenticationCeremony } from "./authentication_ceremony.ts";
import { AuthenticationComponent } from "./authentication_component.ts";

export interface RegistrationStep {
	state: string;
	ceremony: AuthenticationCeremony;
	current: AuthenticationComponent;
	validating: boolean;
}

export const RegistrationStep: TObject<{
	state: TString;
	ceremony: typeof AuthenticationCeremony;
	current: typeof AuthenticationComponent;
	validating: TBoolean;
}> = Type.Object({
	state: Type.String(),
	ceremony: AuthenticationCeremony,
	current: AuthenticationComponent,
	validating: Type.Boolean(),
}, { $id: "RegistrationStep" });
