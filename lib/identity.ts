import { type Static, t } from "../deps.ts";

export const IDENTITY_AUTOID_PREFIX = "id_";

export const IDSchema = t.Object({
	id: t.String(),
	meta: t.Record(t.String(), t.Unknown()),
}, { $id: "ID" });

export type ID = Static<typeof IDSchema>;

export const IdentityComponentSchema = t.Object({
	id: t.String(),
	identification: t.Optional(t.String()),
	confirmed: t.Boolean(),
	meta: t.Record(t.String(), t.Unknown()),
}, { $id: "IdentityComponent" });

export type IdentityComponent = Static<typeof IdentityComponentSchema>;

export const IdentitySchema = t.Object({
	id: t.String(),
	meta: t.Record(t.String(), t.Unknown()),
	components: t.Record(t.String(), IdentityComponentSchema),
}, { $id: "Identity" });

export type Identity = Static<typeof IdentitySchema>;

export class IdentityNotFoundError extends Error {
	name = "IdentityNotFoundError" as const;
}
export class IdentityExistsError extends Error {
	name = "IdentityExistsError" as const;
}
export class IdentityCreateError extends Error {
	name = "IdentityCreateError" as const;
}
export class IdentityUpdateError extends Error {
	name = "IdentityUpdateError" as const;
}
export class IdentityDeleteError extends Error {
	name = "IdentityDeleteError" as const;
}
export class IdentityComponentNotFoundError extends Error {
	name = "IdentityComponentNotFoundError" as const;
}
export class IdentityComponentCreateError extends Error {
	name = "IdentityComponentCreateError" as const;
}
export class IdentityComponentUpdateError extends Error {
	name = "IdentityComponentUpdateError" as const;
}
export class IdentityComponentDeleteError extends Error {
	name = "IdentityComponentDeleteError" as const;
}
export class IdentityComponentExistsError extends Error {
	name = "IdentityComponentExistsError" as const;
}
