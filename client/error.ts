import * as apiErrors from "../common/api/errors.ts";
import { ApiResultData, isApiResultError } from "../common/api/result.ts";
import * as authErrors from "../common/authentication/errors.ts";
import * as counterErrors from "../common/counter/errors.ts";
import * as identityErrors from "../common/identity/errors.ts";
import * as kvErrors from "../common/kv/errors.ts";
import * as messageErrors from "../common/message/errors.ts";
import * as sessionErrors from "../common/session/errors.ts";

interface Error {
	new (message?: string, options?: ErrorOptions): globalThis.Error;
}

const errorMap = new Map<string, Error>([
	...Object.entries(apiErrors),
	...Object.entries(authErrors),
	...Object.entries(counterErrors),
	...Object.entries(identityErrors),
	...Object.entries(kvErrors),
	...Object.entries(messageErrors),
	...Object.entries(sessionErrors),
]);

export function throwIfApiError(
	value: unknown,
): asserts value is ApiResultData {
	if (isApiResultError(value)) {
		const errorName = value.error;
		const errorConstructor = errorMap.get(errorName);
		if (errorConstructor) {
			throw new errorConstructor();
		}
		throw new UnknownApiResultError();
	}
}

export class UnknownApiResultError extends Error {
	name = "UnknownApiResultError" as const;
}
