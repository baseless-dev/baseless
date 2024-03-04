import { Value } from "../lib/typebox.ts";
import { type ApiResponseData, ApiResponseErrorSchema } from "../lib/api.ts";
import * as authErrors from "../lib/authentication/errors.ts";
import * as counterErrors from "../lib/counter/errors.ts";
import * as documentErrors from "../lib/document/errors.ts";
import * as identityErrors from "../lib/identity/errors.ts";
import * as kvErrors from "../lib/kv/errors.ts";
import * as notificationErrors from "../lib/notification/errors.ts";
import * as sessionErrors from "../lib/session/errors.ts";
export * from "../lib/api.ts";
export * from "../lib/authentication/errors.ts";
export * from "../lib/counter/errors.ts";
export * from "../lib/document/errors.ts";
export * from "../lib/identity/errors.ts";
export * from "../lib/kv/errors.ts";
export * from "../lib/notification/errors.ts";
export * from "../lib/session/errors.ts";

// deno-lint-ignore no-explicit-any
const errorMap = new Map<string, any>([
	...Object.entries(authErrors),
	...Object.entries(counterErrors),
	...Object.entries(documentErrors),
	...Object.entries(identityErrors),
	...Object.entries(kvErrors),
	...Object.entries(notificationErrors),
	...Object.entries(sessionErrors),
]);

export function throwIfApiError(
	value: unknown,
): asserts value is ApiResponseData {
	if (Value.Check(ApiResponseErrorSchema, value)) {
		const errorName = value.error;
		const errorConstructor = errorMap.get(errorName);
		if (errorConstructor) {
			throw new errorConstructor();
		}
		throw new UnknownApiResponseError();
	}
}

export class UnknownApiResponseError extends Error {
	name = "UnknownApiResponseError" as const;
}
