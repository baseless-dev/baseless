import { TBoolean, TObject, TString, TUnknown, TVoid, Type } from "@sinclair/typebox";
import { ID, isID, TID } from "@baseless/core/id";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { CollectionDefinitionWithoutSecurity, Context, DocumentDefinitionWithoutSecurity, RpcDefinition } from "../mod.ts";
import { AuthenticationCeremony } from "./ceremony.ts";
import { AuthenticationComponent } from "./component.ts";
import type { KeyLike } from "jose";
import { NotificationProvider } from "../provider/notification.ts";
import { IdentityComponentProvider } from "../provider/identitycomponent.ts";

export interface Session {
	sessionId?: ID<"sid_">;
	identityId: ID<"id_">;
	scope: string[];
	aat: number;
}

export function isSession(value: unknown): value is Session {
	return !!value && typeof value === "object" &&
		(!("sessionId" in value) || ("sessionId" in value && isID("sid_", value.sessionId))) &&
		"identityId" in value && isID("id_", value.identityId) && "scope" in value &&
		Array.isArray(value.scope) && value.scope.every((s) => typeof s === "string") &&
		"aat" in value && typeof value.aat === "number";
}

export function assertSession(value: unknown): asserts value is Session {
	if (!isSession(value)) {
		throw new InvalidSessionError();
	}
}

export class InvalidSessionError extends Error {}

export type AuthenticationDecoration = {
	notification: NotificationProvider;
	currentSession: Session | undefined;
};

export type AuthenticationRpcs = [
	RpcDefinition<["authentication", "signOut"], TVoid, TBoolean>,
	RpcDefinition<
		["authentication", "refreshAccessToken"],
		TString,
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
	RpcDefinition<
		["registration", "getCeremony"],
		typeof RegistrationEncryptedState,
		typeof RegistrationGetCeremonyResponse
	>,
	RpcDefinition<
		["registration", "submitPrompt"],
		TObject<{ id: TString; value: TUnknown; state: typeof RegistrationEncryptedState }>,
		typeof RegistrationGetCeremonyResponse
	>,
	RpcDefinition<
		["registration", "sendValidationCode"],
		TObject<{ id: TString; locale: TString; state: typeof RegistrationEncryptedState }>,
		TBoolean
	>,
	RpcDefinition<
		["registration", "submitValidationCode"],
		TObject<{ id: TString; value: TUnknown; state: typeof RegistrationEncryptedState }>,
		typeof RegistrationGetCeremonyResponse
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
	choices: string[];
	scope: string[];
}

export const AuthenticationEncryptedState = Type.Union([Type.String(), Type.Undefined()], {
	$id: "AuthenticationEncryptedState",
});

export interface AuthenticationTokens {
	access_token: string;
	id_token: string;
	refresh_token?: string;
}

export function isAuthenticationTokens(value: unknown): value is AuthenticationTokens {
	return !!value && typeof value === "object" &&
		"access_token" in value && typeof value.access_token === "string" &&
		"id_token" in value && typeof value.id_token === "string" &&
		("refresh_token" in value ? typeof value.refresh_token === "string" : true);
}

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

export interface RegistrationState {
	identityId?: ID<"id_">;
	components: IdentityComponent[];
}

export const RegistrationEncryptedState = Type.Union([Type.String(), Type.Undefined()], {
	$id: "RegistrationEncryptedState",
});

export const RegistrationCeremonyStep = Type.Object({
	state: Type.Optional(RegistrationEncryptedState),
	ceremony: AuthenticationCeremony,
	current: AuthenticationComponent,
	validating: Type.Boolean(),
}, { $id: "RegistrationCeremonyStep" });

export const RegistrationGetCeremonyResponse = Type.Union([
	RegistrationCeremonyStep,
	AuthenticationTokens,
], { $id: "RegistrationGetCeremonyResponse" });

export type AuthenticationCeremonyResolver = (
	options: {
		context: AuthenticationContext;
		flow: "authentication" | "registration";
		identityId?: ID<"id_">;
	},
) => Promise<AuthenticationCeremony>;

export interface AuthenticationConfiguration {
	keys: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	ceremony:
		| AuthenticationCeremony
		| AuthenticationCeremonyResolver;
	identityComponentProviders: Record<string, IdentityComponentProvider>;
	notificationProvider: NotificationProvider;
	ceremonyTTL?: number;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	rateLimitPeriod?: number;
	rateLimitCount?: number;
	allowAnonymous?: boolean;
}
