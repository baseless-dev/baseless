import { App, MemoryStorage } from "./app.ts";
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
	) {}

	protected currentUser: User | undefined;

	public getCurrentUser() {
		return this.currentUser;
	}

	/**
	 * @internal
	 */
	public setCurrentUser(user: User | undefined) {
		this.currentUser = user;
	}
}

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
	const auth = new Auth(app);
	const persistence = localStorage.getItem(`baseless_persistence_${app.getClientId()}`) as Persistence;
	setPersistence(auth, persistence ?? Persistence.None);
	return auth;
}

async function getOrRefreshTokens(auth: Auth) {
	const tokens = await auth.app.getTokens();
	if (!tokens) {
		return null;
	}

	try {
		let { payload } = await jwtVerify(tokens.id_token, auth.app.getClientPublicKey());
		if (!payload.exp || payload.exp - Date.now() / 1000 <= 5 * 60) {
			// Refresh tokens
			return Promise.reject("NOTIMPLEMENTED");
		}

		return tokens;
	} catch (_err) {
		return null;
	}
}

/**
 * Returns a JSON Web Token (JWT) used to identify the user to a Firebase service.
 *
 * Returns the current token if it has not expired or if it will not expire in the next five minutes. Otherwise, this will refresh the token and return a new one.
 */
export async function getIdToken(auth: Auth) {
	try {
		const id_token = await getOrRefreshTokens(auth);
		return id_token;
	} catch (_err) {
		return null;
	}
}

/**
 * Returns a deserialized JSON Web Token (JWT) used to identitfy the user to a Firebase service.
 *
 * Returns the current token if it has not expired or if it will not expire in the next five minutes. Otherwise, this will refresh the token and return a new one.
 */
export async function getIdTokenResult(auth: Auth) {
	const tokens = await getOrRefreshTokens(auth);
	if (tokens) {
		const { payload } = await jwtVerify(
			tokens.id_token,
			auth.app.getClientPublicKey(),
		);
		return payload;
	}
	return null;
}

/**
 * Adds an observer for changes to the user's sign-in state.
 */
export function onAuthStateChanged(auth: Auth) {
	return Promise.reject("NOTIMPLEMENTED");
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
		auth.app.setTokens({ id_token, access_token, refresh_token });
		const payload = await getIdTokenResult(auth) ?? {};
		if ("sub" in payload && "email" in payload && "emailConfirmed" in payload && "metadata" in payload) {
			const user = new User<Record<never, never>>(
				payload.sub!,
				payload.email as string,
				payload.emailConfirmed as boolean,
				payload.metadata as Record<never, never>,
			);
			auth.setCurrentUser(user);
			return user;
		}
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
	await auth.app.setTokens(undefined);
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
