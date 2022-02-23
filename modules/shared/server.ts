import { KVScanFilter } from "./kv.ts";

/**
 * Unknown error
 */
export class UnknownError extends Error {
	public name = "UnknownError";
}

export type Commands = { [id: string]: Command };

export type Command =
	| { cmd: "fn.call"; ref: string }
	| { cmd: "db.get"; ref: string }
	| { cmd: "db.create"; ref: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { cmd: "db.update"; ref: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { cmd: "db.list"; ref: string; filter?: KVScanFilter<Record<string, unknown>> }
	| { cmd: "db.delete"; ref: string }
	| { cmd: "kv.get"; key: string }
	| { cmd: "kv.set"; key: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { cmd: "kv.list"; prefix: string; filter?: KVScanFilter<Record<string, unknown>> }
	| { cmd: "kv.delete"; key: string }
	| { cmd: "auth.signin-anonymously" }
	| {
		cmd: "auth.add-sign-with-email-password";
		locale: string;
		email: string;
		password: string;
	}
	| {
		cmd: "auth.create-user-with-email-password";
		locale: string;
		email: string;
		password: string;
	}
	| { cmd: "auth.signin-with-email-password"; email: string; password: string }
	| { cmd: "auth.send-email-validation-code"; locale: string; email: string }
	| { cmd: "auth.validate-email"; email: string; code: string }
	| { cmd: "auth.send-password-reset-code"; locale: string; email: string }
	| {
		cmd: "auth.reset-password";
		email: string;
		code: string;
		password: string;
	}
	| {
		cmd: "auth.refresh-tokens";
		refresh_token: string;
	};

export type Results = { [id: string]: Result };

export type Result =
	| { error: string; args?: string[] }
	| { ret: string }
	| { metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { docs: { ref: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }[] }
	| { access_token: string; refresh_token?: string }
	| Record<never, never>;
