import * as z from "./schema.ts";
import type { ID } from "./id.ts";

/**
 * An Identity.
 */
export interface Identity {
	id: ID<"id_">;
	data: Record<string, unknown>;
}

/**
 * Create a type schema for an Identity.
 * @returns The Identity schema.
 */
export const Identity: z.ZodType<Identity> = z.strictObject({
	id: z.id("id_"),
	data: z.record(z.string(), z.unknown()),
}).meta({ id: "Identity" });

export interface IdentityComponent {
	identityId: ID<"id_">;
	componentId: string;
	confirmed: boolean;
	identification?: string;
	data: Record<string, unknown>;
}

export const IdentityComponent: z.ZodType<IdentityComponent> = z.strictObject({
	identityId: z.id("id_"),
	componentId: z.string(),
	identification: z.optional(z.string()),
	confirmed: z.boolean(),
	data: z.record(z.string(), z.unknown()),
}).meta({ id: "IdentityComponent" });

export interface IdentityChannel {
	identityId: ID<"id_">;
	channelId: string;
	confirmed: boolean;
	data: Record<string, unknown>;
}

export const IdentityChannel: z.ZodType<IdentityChannel> = z.strictObject({
	identityId: z.id("id_"),
	channelId: z.string(),
	confirmed: z.boolean(),
	data: z.record(z.string(), z.unknown()),
}).meta({ id: "IdentityChannel" });
