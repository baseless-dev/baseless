import { TBoolean, TObject, TString, TUnknown, TVoid, Type } from "@sinclair/typebox";
import { ID, isID, TID } from "@baseless/core/id";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import {
	CollectionDefinitionWithoutSecurity,
	Context,
	DocumentDefinitionWithoutSecurity,
	RpcDefinition,
} from "../mod.ts";
import { AuthenticationCeremony } from "./ceremony.ts";
import { AuthenticationComponent } from "./component.ts";
import { NotificationProvider } from "./provider.ts";

export interface Session {
	sessionId: ID<"sess_">;
	identityId: ID<"id_">;
	scope: string[];
	aat: number;
}

export function isSession(value: unknown): value is Session {
	return !!value && typeof value === "object" && "sessionId" in value &&
		isID("sess_", value.sessionId) &&
		"identityId" in value && isID("id_", value.identityId) && "scope" in value &&
		typeof value.scope === "string" &&
		"aat" in value && typeof value.aat === "number";
}

export function assertSession(value: unknown): asserts value is Session {
	if (!isSession(value)) {
		throw new InvalidSessionError();
	}
}

export class InvalidSessionError extends Error {}

export interface AuthenticationDecoration {
	notification: NotificationProvider;
	currentSession: Session | undefined;
}

export type AuthenticationRpcs = [
	RpcDefinition<["authentication", "signOut"], TVoid, TBoolean>,
	RpcDefinition<
		["authentication", "refreshAccessToken"],
		TObject<{ refresh_token: TString }>,
		typeof AuthenticationTokens
	>,
	RpcDefinition<
		["authentication", "getCeremony"],
		typeof AuthenticationEncryptedState,
		typeof AuthenticationGetCeremonyResponse
	>,
	RpcDefinition<
		["authentication", "submitPrompt"],
		TObject<{ id: TString; value: TUnknown; state: typeof AuthenticationEncryptedState }>,
		typeof AuthenticationGetCeremonyResponse
	>,
	RpcDefinition<
		["authentication", "sendPrompt"],
		TObject<{ id: TString; locale: TString; state: typeof AuthenticationEncryptedState }>,
		TBoolean
	>,
];

export type AuthenticationDocuments = [
	DocumentDefinitionWithoutSecurity<
		["identities", string],
		typeof Identity
	>,
	DocumentDefinitionWithoutSecurity<
		["identities", string, "components", string],
		typeof IdentityComponent
	>,
	DocumentDefinitionWithoutSecurity<
		["identifications", "{kind}", "{identification}"],
		TID<"id_">
	>,
];

export type AuthenticationCollections = [
	CollectionDefinitionWithoutSecurity<["identities"], typeof Identity>,
	CollectionDefinitionWithoutSecurity<
		["identities", "{identityId}", "components"],
		typeof IdentityComponent
	>,
];

export type AuthenticationContext = Context<
	AuthenticationDecoration,
	AuthenticationDocuments,
	AuthenticationCollections
>;

export interface AuthenticationState {
	identityId?: ID<"id_">;
	choices?: string[];
	scope?: string[];
}

export const AuthenticationEncryptedState = Type.Union([Type.String(), Type.Undefined()], {
	$id: "AuthenticationState",
});

export const AuthenticationTokens = Type.Object({
	access_token: Type.String(),
	id_token: Type.String(),
	refresh_token: Type.Optional(Type.String()),
}, { $id: "AuthenticationTokens" });

export const AuthenticationGetCeremonyResponse = Type.Union([
	Type.Object({
		state: Type.Optional(AuthenticationEncryptedState),
		ceremony: AuthenticationCeremony,
		current: AuthenticationComponent,
	}, { $id: "AuthenticationCeremonyStep" }),
	AuthenticationTokens,
], { $id: "AuthenticationGetCeremonyResponse" });
