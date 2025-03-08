import * as Type from "./schema.ts";
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
export const Identity: Type.TObject<{
	id: Type.TID<"id_">;
	data: Type.TRecord<Type.TUnknown>;
}, ["id", "data"]> = Type.Object(
	{
		id: Type.ID("id_"),
		data: Type.Record(Type.Unknown()),
	},
	["id", "data"],
	{ $id: "Identity" },
);

export class InvalidIdentityError extends Error {}

export interface IdentityComponent {
	identityId: ID<"id_">;
	componentId: string;
	confirmed: boolean;
	identification?: string;
	data: Record<string, unknown>;
}

export const IdentityComponent: Type.TObject<{
	identityId: Type.TID<"id_">;
	componentId: Type.TString;
	identification: Type.TString;
	confirmed: Type.TBoolean;
	data: Type.TRecord<Type.TUnknown>;
}, ["identityId", "componentId", "confirmed", "data"]> = Type.Object(
	{
		identityId: Type.ID("id_"),
		componentId: Type.String(),
		identification: Type.String(),
		confirmed: Type.Boolean(),
		data: Type.Record(Type.Unknown()),
	},
	["identityId", "componentId", "confirmed", "data"],
	{ $id: "IdentityComponent" },
);

export interface IdentityChannel {
	identityId: ID<"id_">;
	channelId: string;
	confirmed: boolean;
	data: Record<string, unknown>;
}

export const IdentityChannel: Type.TObject<{
	identityId: Type.TID<"id_">;
	channelId: Type.TString;
	confirmed: Type.TBoolean;
	data: Type.TRecord<Type.TUnknown>;
}, ["identityId", "channelId", "confirmed", "data"]> = Type.Object({
	identityId: Type.ID("id_"),
	channelId: Type.String(),
	confirmed: Type.Boolean(),
	data: Type.Record(Type.Unknown()),
}, ["identityId", "channelId", "confirmed", "data"]);
