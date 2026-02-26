import * as z from "./schema.ts";
import { Identity } from "./identity.ts";
import { ID } from "@baseless/core/id";

/**
 * A server-side session record linking an {@link Identity}, its issuance time,
 * and the OAuth2-style scopes granted to it.
 */
export interface Session {
	id: ID<"ses_">;
	identityId: Identity["id"];
	issuedAt: number;
	scope: string[];
}

/** Zod schema for {@link Session}. */
export const Session: z.ZodType<Session> = z.strictObject({
	id: z.id("ses_"),
	identityId: z.id("id_"),
	issuedAt: z.number(),
	scope: z.array(z.string()),
}).meta({ id: "Session" });
