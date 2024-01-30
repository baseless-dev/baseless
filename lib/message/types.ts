import { type Static, t } from "../../deps.ts";

export const Message = t.Object({
	recipient: t.String(),
	text: t.String(),
	subject: t.Optional(t.String()),
	html: t.Optional(t.String()),
}, { $id: "Message" });

export type Message = Static<typeof Message>;
