import { App } from "./app.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.3.7/jwt/verify.ts";
import {
	AddSignInEmailPasswordError,
	AnonymousUserError,
	AuthIdentifier,
	CreateUserError,
	DeleteUserError,
	EmailNeedsConfirmationError,
	EmailNotFoundError,
	PasswordResetError,
	SetPasswordResetError,
	SetValidationCodeError,
	SignInEmailPasswordError,
	UpdateUserError,
	UserAlreadyExistsError,
	UserNeedsAnEmailError,
	UserNotFoundError,
	ValidationCodeError,
} from "https://baseless.dev/x/shared/auth.ts";
import { UnknownError } from "https://baseless.dev/x/shared/server.ts";
import { EventEmitter } from "./utils.ts";
import { MemoryStorage } from "./storages/memory.ts";

export class User<Metadata = Record<never, never>> {
	public constructor(
		/**
		 * Unique identifier of the user
		 */
		public id: AuthIdentifier,
		/**
		 * Unique email of the user
		 */
		public email: string | null,
		/**
		 * Has user confirmed his email?
		 */
		public emailConfirmed: boolean,
		/**
		 * Metadata of the object
		 */
		public metadata: Metadata,
	) {}
}

export class Session {
	public constructor(
		public readonly issueAt: Date,
		public readonly expireAt: Date,
		public readonly scope: string,
	) {}
}

/**
 * Class representing Baseless Auth service.
 */
export class Auth {
	/**
	 * Construct an `Auth` object
	 * @internal
	 */
	public constructor(
		public readonly app: App,
		/**
		 * Language code to be sent as local on supported commands
		 */
		public languageCode: string = "en",
	) {
		app.setAuth(this);
	}

	protected _tokens: Tokens | undefined;
	protected _eventOnAuthStateChange = new EventEmitter<[User, Session] | [undefined, undefined]>();
	protected _currentUser: User | undefined;
	protected _currentSession: Session | undefined;
	protected _timerTokenExpired = 0;

	public getCurrentUser() {
		return this._currentUser;
	}

	public getCurrentSession() {
		return this._currentSession;
	}

	public loadTokensFromStorage() {
		try {
			const tokens = JSON.parse(this.app.getStorage().getItem("tokens") ?? "");
			if ("id_token" in tokens && "access_token" in tokens) {
				this.setTokens(tokens);
			}
		} // deno-lint-ignore no-empty
		catch (_err) {}
	}

	public getTokens() {
		return this._tokens;
	}

	public async setTokens(tokens: { id_token: string; access_token: string; refresh_token?: string } | undefined) {
		if (tokens) {
			const id_result = await getJWTResult(this, tokens.id_token) ?? {};
			const access_result = await getJWTResult(this, tokens.access_token) ?? {};
			const refresh_result = tokens.refresh_token ? await getJWTResult(this, tokens.refresh_token) : null;

			const expireAt = Math.max(access_result.exp ?? 0, refresh_result?.exp ?? 0) * 1000;
			const expiredIn = expireAt - Date.now();

			if (
				expiredIn <= 0 ||
				!("sub" in id_result && "email" in id_result && "emailConfirmed" in id_result && "metadata" in id_result)
			) {
				this.app.getStorage().removeItem("tokens");
				this._tokens = undefined;
				this._currentUser = undefined;
				this._currentSession = undefined;
				if (this._timerTokenExpired) {
					clearTimeout(this._timerTokenExpired);
					this._timerTokenExpired = 0;
				}
			} else {
				const user = new User<Record<never, never>>(
					id_result.sub!,
					id_result.email as string,
					id_result.emailConfirmed as boolean,
					id_result.metadata as Record<never, never>,
				);
				const session = new Session(
					new Date(access_result.iat! * 1000),
					new Date(expireAt),
					`${access_result.scope ?? ""}`,
				);

				this.app.getStorage().setItem("tokens", JSON.stringify(tokens));
				this._tokens = {
					id_token: tokens.id_token,
					id_result,
					access_token: tokens.access_token,
					access_result,
					refresh_token: tokens.refresh_token!,
					refresh_result: refresh_result ?? undefined,
				};
				this._currentUser = user;
				this._currentSession = session;

				if (this._timerTokenExpired) {
					clearTimeout(this._timerTokenExpired);
					this._timerTokenExpired = 0;
				}
				if (expiredIn > 0) {
					this._timerTokenExpired = setTimeout(() => {
						this.setTokens(undefined);
					}, expiredIn);
				}
			}
		} else {
			this.app.getStorage().removeItem("tokens");
			this._tokens = undefined;
			this._currentUser = undefined;
			this._currentSession = undefined;
		}
		this._eventOnAuthStateChange.emit(this._currentUser!, this._currentSession!);
	}

	public onAuthStateChange(handler: (user: User | undefined, session: Session | undefined) => void) {
		return this._eventOnAuthStateChange.listen(handler);
	}
}

export type IdToken = {
	id_token: string;
	id_result: TokenResult;
};

export type AccessToken = {
	access_token: string;
	access_result: TokenResult;
};

export type RefreshToken = {
	refresh_token: string;
	refresh_result: TokenResult;
};

export type TokenResult = {
	/**
	 * JWT Issuer - [RFC7519#section-4.1.1](https://tools.ietf.org/html/rfc7519#section-4.1.1).
	 */
	iss?: string;

	/**
	 * JWT Subject - [RFC7519#section-4.1.2](https://tools.ietf.org/html/rfc7519#section-4.1.2).
	 */
	sub?: string;

	/**
	 * JWT Audience [RFC7519#section-4.1.3](https://tools.ietf.org/html/rfc7519#section-4.1.3).
	 */
	aud?: string | string[];

	/**
	 * JWT ID - [RFC7519#section-4.1.7](https://tools.ietf.org/html/rfc7519#section-4.1.7).
	 */
	jti?: string;

	/**
	 * JWT Not Before - [RFC7519#section-4.1.5](https://tools.ietf.org/html/rfc7519#section-4.1.5).
	 */
	nbf?: number;

	/**
	 * JWT Expiration Time - [RFC7519#section-4.1.4](https://tools.ietf.org/html/rfc7519#section-4.1.4).
	 */
	exp?: number;

	/**
	 * JWT Issued At - [RFC7519#section-4.1.6](https://tools.ietf.org/html/rfc7519#section-4.1.6).
	 */
	iat?: number;

	/**
	 * Any other JWT Claim Set member.
	 */
	[propName: string]: unknown;
};

export type Tokens = (IdToken & AccessToken) | (IdToken & AccessToken & RefreshToken);

export enum Persistence {
	Local = "local",
	Session = "session",
	None = "none",
}

const errorMap = new Map<string, new () => Error>([
	["UnknownError", UnknownError],
	["CreateUserError", CreateUserError],
	["DeleteUserError", DeleteUserError],
	["UpdateUserError", UpdateUserError],
	["UserNotFoundError", UserNotFoundError],
	["AnonymousUserError", AnonymousUserError],
	["EmailNotFoundError", EmailNotFoundError],
	["PasswordResetError", PasswordResetError],
	["ValidationCodeError", ValidationCodeError],
	["SetPasswordResetError", SetPasswordResetError],
	["UserNeedsAnEmailError", UserNeedsAnEmailError],
	["UserAlreadyExistsError", UserAlreadyExistsError],
	["SetValidationCodeError", SetValidationCodeError],
	["SignInEmailPasswordError", SignInEmailPasswordError],
	["EmailNeedsConfirmationError", EmailNeedsConfirmationError],
	["AddSignInEmailPasswordError", AddSignInEmailPasswordError],
]);

function authErrorCodeToError(errorCode: string): Error | undefined {
	if (errorMap.has(errorCode)) {
		const error = errorMap.get(errorCode)!;
		return new error();
	}
}

/**
 * Returns the Auth instance associated with the provided `BaselessApp`.
 */
export function getAuth(app: App) {
	let auth = app.getAuth();
	if (auth) {
		return auth;
	}
	auth = new Auth(app);
	const savedPersistence = localStorage.getItem(`baseless_persistence_${app.getClientId()}`) as Persistence;
	setPersistence(auth, savedPersistence ?? Persistence.None);
	auth.loadTokensFromStorage();
	return auth;
}

/**
 * Verifies the JWT format (to be a JWS Compact format), verifies the JWS signature, validates the JWT Claims Set and return the payload of the JWT.
 */
async function getJWTResult(auth: Auth, jwt: string): Promise<TokenResult | null> {
	try {
		const { payload } = await jwtVerify(
			jwt,
			auth.app.getClientPublicKey(),
		);
		return payload;
	} catch (_err) {
		return null;
	}
}

/**
 * Adds an observer for changes to the user's sign-in state.
 */
export function onAuthStateChanged(
	auth: Auth,
	handler: (user: User | undefined, session: Session | undefined) => void,
) {
	return auth.onAuthStateChange(handler);
}

/**
 * Creates a new user account associated with the specified email address and password.
 *
 * On successful creation of the user account, this user will also be signed in to your application.
 *
 * User account creation can fail if the account already exists or the password is invalid.
 */
export async function createUserWithEmailAndPassword(
	auth: Auth,
	email: string,
	password: string,
) {
	const res = await auth.app.send({
		cmd: "auth.create-user-with-email-password",
		email,
		password,
		locale: auth.languageCode,
	});
	console.log(res);
	debugger;
}

/**
 * Sends a verification email to a user.
 *
 * The verification process is completed by calling `validateEmail`.
 */
export function sendEmailVerification(auth: Auth) {
	return Promise.reject("NOTIMPLEMENTED");
}

/**
 * Applies a verification code sent to the user by email or other out-of-band mechanism.
 */
export async function validateEmail(auth: Auth, code: string, email: string) {
	const res = await auth.app.send({ cmd: "auth.validate-email", email, code });
	console.log(res);
	debugger;
}

/**
 * Sends a password reset email to the given email address.
 *
 * To complete the password reset, call `resetPassword` with the code supplied in the email sent to the user, along with the new password specified by the user.
 */
export function sendPasswordResetEmail(auth: Auth, email: string) {
	return Promise.reject("NOTIMPLEMENTED");
}

/**
 * Completes the password reset process, given a confirmation code and new password.
 */
export function resetPassword(
	auth: Auth,
	code: string,
	email: string,
	newPassword: string,
) {
	return Promise.reject("NOTIMPLEMENTED");
}

/**
 * Changes the type of persistence on the `Auth` instance for the currently saved `Auth` session and applies this type of persistence for future sign-in requests, including sign-in with redirect requests.
 *
 * This makes it easy for a user signing in to specify whether their session should be remembered or not. It also makes it easier to never persist the `Auth` state for applications that are shared by other users or have sensitive data.
 */
export function setPersistence(auth: Auth, persistence: Persistence) {
	localStorage.setItem(`baseless_persistence_${auth.app.getClientId()}`, persistence);
	switch (persistence) {
		case Persistence.Local:
			return auth.app.setStorage(localStorage);
		case Persistence.Session:
			return auth.app.setStorage(sessionStorage);
		case Persistence.None:
		default:
			return auth.app.setStorage(new MemoryStorage());
	}
}

/**
 * Asynchronously signs in as an anonymous user.
 *
 * If there is already an anonymous user signed in, that user will be returned; otherwise, a new anonymous user identity will be created and returned.
 */
export function signInAnonymously(auth: Auth) {
	return Promise.reject("NOTIMPLEMENTED");
}

/**
 * Asynchronously signs in using an email and password.
 *
 * Fails with an error if the email address and password do not match.
 */
export async function signInWithEmailAndPassword(
	auth: Auth,
	email: string,
	password: string,
) {
	const res = await auth.app.send({ cmd: "auth.sign-with-email-password", email, password });
	if ("id_token" in res && "access_token" in res) {
		const { id_token, access_token, refresh_token } = res;
		await auth.setTokens({ id_token, access_token, refresh_token });
		return auth.getCurrentUser();
	} else if ("error" in res) {
		throw authErrorCodeToError(res["error"]);
	} else {
		throw new UnknownError();
	}
}

/**
 * Signs out the current user.
 */
export async function signOut(auth: Auth) {
	await auth.setTokens(undefined);
}

/**
 * Updates the user's email address.
 *
 * An email will be sent to the original email address (if it was set) that allows to revoke the email address change, in order to protect them from account hijacking.
 */
export function updateEmail(auth: Auth, newEmail: string) {
	return Promise.reject("NOTIMPLEMENTED");
}

/**
 * Updates the user's password.
 */
export function updatePassword(auth: Auth, newPassword: string) {
	return Promise.reject("NOTIMPLEMENTED");
}
