export type Json =
	| JsonValue
	| JsonArray
	| JsonObject;
export type JsonValue = string | number | boolean | null;
// deno-lint-ignore no-empty-interface
export interface JsonArray extends Array<Json> {}
// deno-lint-ignore no-empty-interface
export interface JsonObject extends Record<string, Json> {}

export function isJsonValue(value?: unknown): value is JsonValue {
	return !(typeof value !== "undefined") || value === null ||
		typeof value === "string" || typeof value === "number" ||
		typeof value === "boolean";
}
export function assertJsonValue(value?: unknown): asserts value is JsonValue {
	if (!isJsonValue(value)) {
		throw new InvalidJsonValueError();
	}
}
export class InvalidJsonValueError extends Error {
	name = "InvalidJsonValueError" as const;
}

export function isJsonArray(value?: unknown): value is JsonArray {
	return !!value && Array.isArray(value) && value.every(isJson);
}
export function assertJsonArray(value?: unknown): asserts value is JsonArray {
	if (!isJsonArray(value)) {
		throw new InvalidJsonArrayError();
	}
}
export class InvalidJsonArrayError extends Error {
	name = "InvalidJsonArrayError" as const;
}

export function isJsonObject(value?: unknown): value is JsonObject {
	return !!value && typeof value === "object" &&
		Object.values(value).every(isJson);
}
export function assertJsonObject(value?: unknown): asserts value is JsonObject {
	if (!isJsonObject(value)) {
		throw new InvalidJsonObjectError();
	}
}
export class InvalidJsonObjectError extends Error {
	name = "InvalidJsonObjectError" as const;
}

export function isJson(value?: unknown): value is Json {
	return isJsonValue(value) || isJsonArray(value) || isJsonObject(value);
}

export function assertJson(value?: unknown): asserts value is Json {
	if (!isJson(value)) {
		throw new InvalidJsonError();
	}
}

export class InvalidJsonError extends Error {
	name = "InvalidJsonError" as const;
}
