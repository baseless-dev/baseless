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
	public constructor(public readonly app: App) {
		this._storage = new SessionStorage(this);
		this.languageCode = "en";
	}

	/**
	 * @internal
	 */
	public _currentUser: User | undefined;

	/**
	 * @internal
	 */
	public _storage: IStorage;

	/**
	 * Language code to be sent as local on supported commands
	 */
	public languageCode: string;

	private tokenChangeHandlers: TokenChangeHandler[] = [];

	/**
	 * @internal
	 */
	public _onTokensChange(
		handler: TokenChangeHandler,
	): void {
		this.tokenChangeHandlers.push(handler);
	}
}

export type Tokens = {
	id_token: string;
	access_token: string;
	refresh_token?: string;
};

export type TokenChangeHandler = (
	tokens: Tokens | undefined,
	user: User | undefined,
) => Promise<void>;

export interface IStorage {
	getPersistence(): Persistence;
	getTokens(): Promise<Tokens | undefined>;
	setTokens(tokens: Tokens | undefined): Promise<void>;
}

export class LocalStorage implements IStorage {
	constructor(protected auth: Auth) {}

	getPersistence(): Persistence {
		return Persistence.Local;
	}

	getTokens(): Promise<Tokens | undefined> {
		return new Promise((resolve) => {
			const value = localStorage.getItem(
				`baseless-${this.auth.app.clientId}-tokens`,
			);
			try {
				if (value) {
					return resolve(JSON.parse(value) as Tokens);
				}
			} catch (_err) {}
			return resolve(undefined);
		});
	}

	setTokens(tokens: Tokens | undefined): Promise<void> {
		return new Promise((resolve) => {
			localStorage.setItem(
				`baseless-${this.auth.app.clientId}-tokens`,
				JSON.stringify(tokens),
			);
			return resolve();
		});
	}
}

export class SessionStorage implements IStorage {
	constructor(protected auth: Auth) {}

	getPersistence(): Persistence {
		return Persistence.Session;
	}

	getTokens(): Promise<Tokens | undefined> {
		return new Promise((resolve) => {
			const value = sessionStorage.getItem(
				`baseless-${this.auth.app.clientId}-tokens`,
			);
			try {
				if (value) {
					return resolve(JSON.parse(value) as Tokens);
				}
			} catch (_err) {}
			return resolve(undefined);
		});
	}

	setTokens(tokens: Tokens | undefined): Promise<void> {
		return new Promise((resolve) => {
			sessionStorage.setItem(
				`baseless-${this.auth.app.clientId}-tokens`,
				JSON.stringify(tokens),
			);
			return resolve();
		});
	}
}

export class MemoryStorage implements IStorage {
	private tokens: Tokens | undefined;

	getPersistence(): Persistence {
		return Persistence.None;
	}

	getTokens(): Promise<Tokens | undefined> {
		return new Promise((resolve) => {
			return resolve(this.tokens);
		});
	}

	setTokens(tokens: Tokens | undefined): Promise<void> {
		return new Promise((resolve) => {
			this.tokens = tokens;
			return resolve();
		});
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
	return new Auth(app);
}

async function getOrRefreshTokens(auth: Auth) {
	const tokens = await auth._storage.getTokens();
	if (!tokens) {
		return null;
	}

	try {
		let { payload } = await jwtVerify(tokens.id_token, auth.app.clientPublicKey);
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
export async function createUserWithEmailAndPassword(
	auth: Auth,
	email: string,
	password: string,
) {
	const req = new Request(auth.app.prepareRequest(), {
		body: JSON.stringify({
			"1": {
				cmd: "auth.create-user-with-email-password",
				email,
				password,
				locale: auth.languageCode,
			},
		}),
	});
	const res = await fetch(req);
	const json = await res.json();
	console.log(json);
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
	const req = new Request(auth.app.prepareRequest(), {
		body: JSON.stringify({
			"1": {
				cmd: "auth.validate-email",
				email,
				code,
			},
		}),
	});
	const res = await fetch(req);
	const json = await res.json();
	console.log(json);
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
export async function setPersistence(auth: Auth, persistence: Persistence) {
	const oldPersistence = auth._storage.getPersistence();
	if (oldPersistence !== persistence) {
		// Get old tokens
		const oldTokens = await auth._storage.getTokens();
		// Clear tokens from previous storage
		await auth._storage.setTokens(undefined);
		switch (persistence) {
			case Persistence.Local:
				auth._storage = new LocalStorage(auth);
				break;
			case Persistence.Session:
				auth._storage = new SessionStorage(auth);
				break;
			case Persistence.None:
				auth._storage = new MemoryStorage();
				break;
		}
		// Set old tokens in new storage
		auth._storage.setTokens(oldTokens);
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
	const req = new Request(auth.app.prepareRequest(), {
		body: JSON.stringify({
			"1": { cmd: "auth.sign-with-email-password", email, password },
		}),
	});
	const res = await fetch(req);
	const json = await res.json();
	const result = json["1"];
	if ("id_token" in result && "access_token" in result) {
		const { id_token, access_token, refresh_token } = result;
		auth._storage.setTokens({ id_token, access_token, refresh_token });
		const payload = await getIdTokenResult(auth) ?? {};
		if ("sub" in payload && "email" in payload && "emailConfirmed" in payload && "metadata" in payload) {
			const user = new User<Record<never, never>>(
				payload.sub!,
				payload.email as string,
				payload.emailConfirmed as boolean,
				payload.metadata as Record<never, never>,
			);
			auth._currentUser = user;
			return user;
		}
	}
	throw authErrorCodeToError(result["error"]);
}

/**
 * Signs out the current user.
 */
export async function signOut(auth: Auth) {
	await auth._storage.setTokens(undefined);
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
