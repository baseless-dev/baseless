import { AuthenticationComponent } from "./authentication_component.ts";
import * as z from "./schema.ts";

export interface AuthenticationStep {
	step: AuthenticationComponent;
	state: string;
	expireAt: number;
	validating: boolean;
}

export const AuthenticationStep = z.strictObject({
	step: AuthenticationComponent,
	state: z.string(),
	expireAt: z.number(),
	validating: z.boolean(),
}).meta({ id: "AuthenticationStep" });
