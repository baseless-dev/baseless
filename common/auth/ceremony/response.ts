import { IDENTITY_AUTOID_PREFIX } from "../../identity/identity.ts";
import { s } from "../../schema/mod.ts";
import { AuthenticationCeremonyComponentSchema } from "./ceremony.ts";
import { AuthenticationCeremonyStateSchema } from "./state.ts";

export const AuthenticationCeremonyResponseDoneSchema = s.object({
	done: s.literal(true),
	identityId: s.autoid(IDENTITY_AUTOID_PREFIX),
});

export const AuthenticationCeremonyResponseTokensSchema = s.object({
	done: s.literal(true),
	access_token: s.string(),
	id_token: s.string(),
	refresh_token: s.string(),
}, ["refresh_token"]);

export const AuthenticationCeremonyResponseErrorSchema = s.object({
	done: s.literal(false),
	error: s.literal(true),
});

export const AuthenticationCeremonyResponseStateSchema = s.object({
	state: AuthenticationCeremonyStateSchema,
	done: s.literal(false),
	component: AuthenticationCeremonyComponentSchema,
	first: s.boolean(),
	last: s.boolean(),
});

export const AuthenticationCeremonyResponseEncryptedStateSchema = s.object({
	encryptedState: s.string(),
	done: s.literal(false),
	component: AuthenticationCeremonyComponentSchema,
	first: s.boolean(),
	last: s.boolean(),
});

export const AuthenticationCeremonyResponseSchema = s.union([
	AuthenticationCeremonyResponseDoneSchema,
	AuthenticationCeremonyResponseTokensSchema,
	AuthenticationCeremonyResponseErrorSchema,
	AuthenticationCeremonyResponseStateSchema,
	AuthenticationCeremonyResponseEncryptedStateSchema,
]);
