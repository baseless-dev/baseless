import * as z from "./schema.ts";
import { Identity } from "./identity.ts";

export interface Session {
	identityId: Identity["id"];
	issuedAt: number;
	scope: string[];
}

export const Session = z.strictObject({
	identityId: z.id("id_"),
	issuedAt: z.number(),
	scope: z.array(z.string()),
}).meta({ id: "Session" });
