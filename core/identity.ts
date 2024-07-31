import {
	type TObject,
	type TOptional,
	type TRecord,
	type TString,
	type TUnknown,
	Type,
} from "@sinclair/typebox";
import { ID, isID, type TID } from "./id.ts";

/**
 * An Identity.
 */
export interface Identity {
	identityId: ID<"id_">;
	data?: Record<string, unknown>;
}

/**
 * Create a type schema for an Identity.
 * @returns The Identity schema.
 */
export const Identity: TObject<{
	identityId: TID<"id_">;
	data: TOptional<TRecord<TString, TUnknown>>;
}> = Type.Object({
	identityId: ID("id_"),
	data: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
}, { $id: "Identity" });

/**
 * Check if the Identity is valid.
 * @param id The Identity to check.
 * @returns Whether the Identity is valid.
 *
 * ```ts
 * const isIdentityValid = isIdentity({ identity: "id_foobar" });
 * ```
 */
export function isIdentity(value: unknown): value is Identity {
	return !!value && typeof value === "object" && "identityId" in value &&
		isID("id_", value.identityId) &&
		(!("data" in value) || typeof value.data === "object");
}

/**
 * Asserts that the Identity is valid.
 * @param id The Identity to check
 *
 * ```ts
 * assertIdentity({ identityId: "id_foobar" }); // throws if the Identity is invalid
 * ```
 */
export function assertIdentity(value: unknown): asserts value is Identity {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}

export class InvalidIdentityError extends Error {}

export interface IdentityComponent {
	identityId: ID<"id_">;
	kind: string;
	confirmed: boolean;
	identification?: string;
	data: Record<string, unknown>;
}

export const IdentityComponent = Type.Object({
	identityId: ID("id_"),
	kind: Type.String(),
	identification: Type.Optional(Type.String()),
	confirmed: Type.Boolean(),
	data: Type.Record(Type.String(), Type.Unknown()),
}, { $id: "IdentityComponent" });
