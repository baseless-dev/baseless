import * as apiErrors from "../common/api/errors.ts";
import { ApiResponseData, isApiResponseError } from "../common/api/response.ts";
import * as authErrors from "../common/auth/errors.ts";
import * as counterErrors from "../common/counter/errors.ts";
import * as identityErrors from "../common/identity/errors.ts";
import * as kvErrors from "../common/kv/errors.ts";
import * as messageErrors from "../common/message/errors.ts";
import * as sessionErrors from "../common/session/errors.ts";

interface Error {
	new(message?: string, options?: ErrorOptions): globalThis.Error;
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
): asserts value is ApiResponseData {
	if (isApiResponseError(value)) {
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
