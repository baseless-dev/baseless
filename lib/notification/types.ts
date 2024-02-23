import { type Static, t } from "../../deps.ts";

export const Notification = t.Object({
	subject: t.Optional(t.String()),
	content: t.Record(t.String(), t.String(), { minProperties: 1 }),
}, { $id: "Notification" });

export type Notification = Static<typeof Notification>;
