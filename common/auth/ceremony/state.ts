import { IDENTITY_AUTOID_PREFIX } from "../../identity/identity.ts";
import { s } from "../../schema/mod.ts";

export const AuthenticationCeremonyStateAnonymousSchema = s.object({
	choices: s.array(s.string()),
});

export const AuthenticationCeremonyStateIdentifiedSchema = s.object({
	identity: s.autoid(IDENTITY_AUTOID_PREFIX),
	choices: s.array(s.string()),
});

export const AuthenticationCeremonyStateSchema = s.union([
	AuthenticationCeremonyStateAnonymousSchema,
	AuthenticationCeremonyStateIdentifiedSchema,
]);
