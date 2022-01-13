import { App } from "./app.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.3.7/jwt/verify.ts";

/**
 * Class representing Baseless Auth service.
 */
export class Auth {
	/**
	 * Construct an `Auth` object
	 * @internal
	 */
	public constructor(public readonly app: App) {}
}

export type User<Metadata = Record<string, unknown>> =
	| EmailUser<Metadata>
	| AnonymousUser<Metadata>;

export interface IUser<Metadata> {
	/**
	 * Type of the user
	 */
	readonly type: string;

	/**
	 * Unique identifier of the user
	 */
	readonly id: string;

	/**
	 * Metadata of the object
	 */
	readonly metadata: Metadata;
}

export interface EmailUser<Metadata> extends IUser<Metadata> {
	/**
	 * Type of the user
	 */
	readonly type: "email";

	/**
	 * Unique email of the user
	 */
	readonly email: string | null;

	/**
	 * Is email confirmed?
	 */
	readonly isEmailConfirmed: boolean;
}

export interface AnonymousUser<Metadata> extends IUser<Metadata> {
	/**
	 * Type of the user
	 */
	readonly type: "anonymous";
}

export enum Persistence {
	Local = "local",
	Session = "session",
	None = "none",
}

/**
 * Returns the Auth instance associated with the provided `BaselessApp`.
 */
export function getAuth(app: App) {
	return new Auth(app);
}

async function getOrRefreshTokens(auth: Auth) {
	const id_token = auth.app.getIdToken();
	if (!id_token) {
		return null;
	}

	try {
		let { payload } = await jwtVerify(id_token, auth.app.clientPublicKey);
		if (!payload.exp || payload.exp - Date.now() / 1000 <= 5 * 60) {
			// Refresh tokens
		}

		return {
			id_token: auth.app.getIdToken()!,
			access_token: auth.app.getAccessToken()!,
			refresg_token: auth.app.getRefreshToken()!,
		};
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
			auth.app.clientPublicKey,
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
export function createUserWithEmailAndPassword(
	auth: Auth,
	email: string,
	password: string,
) {
	return Promise.reject("NOTIMPLEMENTED");
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
export function validateEmail(auth: Auth, code: string) {
	return Promise.reject("NOTIMPLEMENTED");
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
export function resetPassword(auth: Auth, code: string, newPassword: string) {
	return Promise.reject("NOTIMPLEMENTED");
}

/**
 * Changes the type of persistence on the `Auth` instance for the currently saved `Auth` session and applies this type of persistence for future sign-in requests, including sign-in with redirect requests.
 *
 * This makes it easy for a user signing in to specify whether their session should be remembered or not. It also makes it easier to never persist the `Auth` state for applications that are shared by other users or have sensitive data.
 */
export function setPersistence(auth: Auth, persistence: Persistence) {
	return Promise.reject("NOTIMPLEMENTED");
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
export function signInWithEmailAndPassword(
	auth: Auth,
	email: string,
	password: string,
) {
	return Promise.reject("NOTIMPLEMENTED");
}

/**
 * Signs out the current user.
 */
export function signOut(auth: Auth) {
	return Promise.reject("NOTIMPLEMENTED");
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
