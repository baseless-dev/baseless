import * as Type from "./schema.ts";
import { Identity } from "./identity.ts";

export interface Session {
	identityId: Identity["id"];
	issuedAt: number;
	scope: string[];
}

export const Session: Type.TObject<{
	identityId: Type.TID<"id_">;
	issuedAt: Type.TNumber;
	scope: Type.TArray<Type.TString>;
}, ["identityId", "issuedAt", "scope"]> = Type.Object({
	identityId: Type.Index(Identity, "id"),
	issuedAt: Type.Number(),
	scope: Type.Array(Type.String()),
}, ["identityId", "issuedAt", "scope"]);
