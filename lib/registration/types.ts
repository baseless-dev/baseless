import { Static, t } from "../../deps.ts";
import {
	AtPathAuthenticationCeremonyComponentSchema,
	AuthenticationCeremonyComponentPromptSchema,
} from "../authentication/types.ts";
import {
	IdentityComponentSchema,
	IdentitySchema,
	IDSchema,
} from "../identity/types.ts";

export const REGISTRATION_AUTOID_PREFIX = "rid_";

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

export const RegistrationCeremonyStateDoneSchema = t.Object({
	done: t.Literal(true),
}, { $id: "RegistrationCeremonyStateDone" });

export type RegistrationCeremonyStateDone = Static<
	typeof RegistrationCeremonyStateDoneSchema
>;

export const RegistrationCeremonyStateSchema = t.Union([
	RegistrationCeremonyStateNextSchema,
	RegistrationCeremonyStateDoneSchema,
], { $id: "RegistrationCeremonyState" });

export type RegistrationCeremonyState = Static<
	typeof RegistrationCeremonyStateSchema
>;

export const RegistrationSubmitResultIdentitySchema = t.Object({
	kind: t.Literal("identity"),
	identity: IdentitySchema,
}, { $id: "RegistrationSubmitResultIdentity" });

export const RegistrationSubmitResultSchema = t.Union([
	RegistrationStateSchema,
	RegistrationSubmitResultIdentitySchema,
], { $id: "RegistrationSubmitResult" });

export type RegistrationSubmitResult = Static<
	typeof RegistrationSubmitResultSchema
>;

export const RegistrationSubmitStateDoneSchema = t.Object({
	done: t.Literal(true),
	id: IDSchema,
}, { $id: "RegistrationSubmitStateDone" });

export type RegistrationSubmitStateDone = Static<
	typeof RegistrationSubmitStateDoneSchema
>;

export const RegistrationSubmitStateSchema = t.Union([
	RegistrationCeremonyStateNextSchema,
	RegistrationSubmitStateDoneSchema,
], { $id: "AuthenticationSubmitState" });

export type RegistrationSubmitState = Static<
	typeof RegistrationSubmitStateSchema
>;

export const RegistrationSendValidationCodeResultSchema = t.Object({
	sent: t.Boolean(),
}, { $id: "RegistrationSendValidationCodeResult" });

export type RegistrationSendValidationCodeResult = Static<
	typeof RegistrationSendValidationCodeResultSchema
>;
