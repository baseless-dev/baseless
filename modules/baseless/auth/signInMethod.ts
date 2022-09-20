export enum AuthenticationType {
	Anonymous = "anonymous",
	Email = "email",
	OAuth = "oauth",
}

export enum LoginType {
	OneOf = "oneof",
	Password = "password",
	OneTimePassword = "one-time-password",
	HashBasedOneTimePassword = "hash-based-one-time-password",
	TimeBasedOneTimePassword = "time-based-one-time-password",
}

export type AuthenticationMethod =
	| { readonly type: AuthenticationType.Anonymous }
	| { readonly type: AuthenticationType.Email; readonly loginMethods: ReadonlyArray<LoginMethod> }
	| { readonly type: AuthenticationType.OAuth; readonly oauth: OAuthConfiguration };

export type LoginMethod =
	| { readonly type: LoginType.OneOf; readonly loginMethods: ReadonlyArray<LoginMethod> }
	| { readonly type: LoginType.Password }
	| { readonly type: LoginType.OneTimePassword }
	| { readonly type: LoginType.HashBasedOneTimePassword }
	| { readonly type: LoginType.TimeBasedOneTimePassword };

export interface OAuthConfiguration {
	readonly providerId: string;
	readonly providerLabel: string;
	readonly providerIcon: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly scope: string[];
	readonly authorizationEndpoint: string;
	readonly tokenEndpoint: string;
	readonly openIdEndpoint: string;
}
export function anonymous(): AuthenticationMethod {
	return { type: AuthenticationType.Anonymous };
}

export function email(...loginMethods: LoginMethod[]): AuthenticationMethod {
	return { type: AuthenticationType.Email, loginMethods };
}

export function oauth(oauth: OAuthConfiguration): AuthenticationMethod {
	return { type: AuthenticationType.OAuth, oauth };
}

export function oneOf(...loginMethods: LoginMethod[]): LoginMethod {
	return { type: LoginType.OneOf, loginMethods };
}

export function password(): LoginMethod {
	return { type: LoginType.Password };
}
