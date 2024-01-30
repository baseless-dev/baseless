import { type Static, t } from "../../deps.ts";

export const SESSION_AUTOID_PREFIX = "ses_";

export const SessionDataSchema = t.Object({
	id: t.String(),
	identityId: t.String(),
	meta: t.Record(t.String(), t.Unknown()),
}, { $id: "SessionData" });

export type SessionData = Static<typeof SessionDataSchema>;
