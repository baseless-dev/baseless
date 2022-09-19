export enum AuthenticationType {
	Anonymous,
	Email,
	OAuth,
}

export enum LoginType {
	OneOf,
	Password,
	OneTimePassword,
	HashBasedOneTimePassword,
	TimeBasedOneTimePassword,
}

export abstract class AuthenticationMethod {
	public abstract readonly type: AuthenticationType;
}

export abstract class LoginMethod {
	public abstract readonly type: LoginType;
}

export class AuthenticationMethodAnonymous extends AuthenticationMethod {
	public readonly type = AuthenticationType.Anonymous;
}

export class AuthenticationMethodEmail extends AuthenticationMethod {
	public readonly type = AuthenticationType.Email;
	public constructor(public readonly logInMethods: LoginMethod[]) {
		super();
	}
}

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

export class AuthenticationMethodOAuth extends AuthenticationMethod {
	public readonly type = AuthenticationType.OAuth;

	public constructor(public readonly oauthConfiguration: OAuthConfiguration) {
		super();
	}
}

export class LoginMethodOneOf extends LoginMethod {
	public readonly type = LoginType.OneOf;

	public constructor(public readonly logInMethods: LoginMethod[]) {
		super();
	}
}

export class LoginMethodPassword extends LoginMethod {
	public readonly type = LoginType.Password;
}

export function anonymous() {
	return new AuthenticationMethodAnonymous();
}

export function email(...logInMethods: LoginMethod[]) {
	return new AuthenticationMethodEmail(logInMethods);
}

export function oauth(oauthConfiguration: OAuthConfiguration) {
	return new AuthenticationMethodOAuth(oauthConfiguration);
}

export function oneOf(...signInMethods: LoginMethod[]) {
	return new LoginMethodOneOf(signInMethods);
}

export function password() {
	return new LoginMethodPassword();
}
