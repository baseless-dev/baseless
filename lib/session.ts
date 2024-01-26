import { t } from "../deps.ts";

export const SESSION_AUTOID_PREFIX = "ses_";

export const SessionData = t.Object({
	id: t.String({ format: "autoid" }),
	identityId: t.String({ format: "autoid" }),
	meta: t.Record(t.String(), t.Unknown()),
}, { $id: "SessionData" });

export class SessionIDNotFoundError extends Error {
	name = "SessionIDNotFoundError" as const;
}
export class SessionCreateError extends Error {
	name = "SessionCreateError" as const;
}
export class SessionUpdateError extends Error {
	name = "SessionUpdateError" as const;
}
export class SessionDestroyError extends Error {
	name = "SessionDestroyError" as const;
}
