import { type Static, t } from "../../deps.ts";

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
	components: t.Array(IdentityComponentSchema),
}, { $id: "Identity" });

export type Identity = Static<typeof IdentitySchema>;
