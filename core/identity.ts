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

/**
 * A component linked to an {@link Identity}, representing one authentication
 * factor (e.g. a password or email address). `identification` is an optional
 * unique identifier (e.g. the email value) that is indexed for lookups.
 */
export interface IdentityComponent {
	identityId: ID<"id_">;
	componentId: string;
	confirmed: boolean;
	identification?: string;
	data: Record<string, unknown>;
}

/** Zod schema for {@link IdentityComponent}. */
export const IdentityComponent: z.ZodType<IdentityComponent> = z.strictObject({
	identityId: z.id("id_"),
	componentId: z.string(),
	identification: z.optional(z.string()),
	confirmed: z.boolean(),
	data: z.record(z.string(), z.unknown()),
}).meta({ id: "IdentityComponent" });

/**
 * A notification channel linked to an {@link Identity} (e.g. an email address
 * or phone number used to deliver OTP codes or other messages).
 */
export interface IdentityChannel {
	identityId: ID<"id_">;
	channelId: string;
	confirmed: boolean;
	data: Record<string, unknown>;
}

/** Zod schema for {@link IdentityChannel}. */
export const IdentityChannel: z.ZodType<IdentityChannel> = z.strictObject({
	identityId: z.id("id_"),
	channelId: z.string(),
	confirmed: z.boolean(),
	data: z.record(z.string(), z.unknown()),
}).meta({ id: "IdentityChannel" });
