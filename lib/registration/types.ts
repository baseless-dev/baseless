import { Static, t } from "../../deps.ts";
import {
	AtPathAuthenticationCeremonyComponentSchema,
	AuthenticationCeremonyComponentPromptSchema,
} from "../authentication/types.ts";
import { IdentityComponentSchema } from "../identity/types.ts";

export const RegistrationStateSchema = t.Object({
	kind: t.Literal("registration"),
	identity: t.String(),
	components: t.Array(IdentityComponentSchema),
}, { $id: "RegistrationState" });

export type RegistrationState = Static<
	typeof RegistrationStateSchema
>;

export const RegistrationCeremonyStateNextSchema = t.Object({
	done: t.Literal(false),
	component: AtPathAuthenticationCeremonyComponentSchema,
	first: t.Boolean(),
	last: t.Boolean(),
	state: t.Optional(t.String()),
}, { $id: "RegistrationCeremonyStateNext" });

export type RegistrationCeremonyStateNext = Static<
	typeof RegistrationCeremonyStateNextSchema
>;

export const RegistrationCeremonyStateValidationSchema = t.Object({
	done: t.Literal(false),
	forComponent: AuthenticationCeremonyComponentPromptSchema,
	validationComponent: AuthenticationCeremonyComponentPromptSchema,
	first: t.Boolean(),
	last: t.Boolean(),
	state: t.Optional(t.String()),
}, { $id: "RegistrationCeremonyStateValidation" });

export type RegistrationCeremonyStateValidation = Static<
	typeof RegistrationCeremonyStateValidationSchema
>;

export const RegistrationCeremonyStateDoneSchema = t.Object({
	done: t.Literal(true),
}, { $id: "RegistrationCeremonyStateDone" });

export type RegistrationCeremonyStateDone = Static<
	typeof RegistrationCeremonyStateDoneSchema
>;

export const RegistrationCeremonyStateSchema = t.Union([
	RegistrationCeremonyStateNextSchema,
	RegistrationCeremonyStateValidationSchema,
	RegistrationCeremonyStateDoneSchema,
], { $id: "RegistrationCeremonyState" });

export type RegistrationCeremonyState = Static<
	typeof RegistrationCeremonyStateSchema
>;
