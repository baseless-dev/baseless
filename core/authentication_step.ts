import { AuthenticationComponent } from "./authentication_component.ts";
import * as z from "./schema.ts";

/**
 * Represents a single step in an in-progress authentication or registration
 * ceremony. Carries the {@link AuthenticationComponent} to present, an opaque
 * server-side `state` token, and the Unix timestamp at which the step expires.
 */
export interface AuthenticationStep {
	step: AuthenticationComponent;
	state: string;
	expireAt: number;
	validating: boolean;
}

/** Zod schema for {@link AuthenticationStep}. */
export const AuthenticationStep = z.strictObject({
	step: AuthenticationComponent,
	state: z.string(),
	expireAt: z.number(),
	validating: z.boolean(),
}).meta({ id: "AuthenticationStep" });
