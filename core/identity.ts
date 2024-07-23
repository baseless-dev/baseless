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
		throw new InvalidIdenittyError();
	}
}

/**
 * Error thrown when an Identity is invalid.
 */
export class InvalidIdenittyError extends Error {
	constructor() {
		super(`Invalid identity.`);
	}
}

/**
 * Create a type schema for an Identity.
 * @returns The Identity schema.
 */
export function Identity(): TObject<{
	identityId: TID<"id_">;
	data: TOptional<TRecord<TString, TUnknown>>;
}> {
	return Type.Object({
		identityId: ID("id_"),
		data: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
	}, {
		$id: "Identity",
		title: "Identity",
	});
}
