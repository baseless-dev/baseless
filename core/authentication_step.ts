import { AuthenticationComponent } from "./authentication_component.ts";
import * as Type from "./schema.ts";

export interface AuthenticationStep {
	step: AuthenticationComponent;
	state: string;
	validating: boolean;
}

export const AuthenticationStep: Type.TObject<{
	step: typeof AuthenticationComponent;
	state: Type.TString;
	validating: Type.TBoolean;
}, ["step", "state", "validating"]> = Type.Object({
	step: AuthenticationComponent,
	state: Type.String(),
	validating: Type.Boolean(),
}, ["step", "state", "validating"]);
