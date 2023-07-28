import { assertSchema, isSchema, type Schema } from "../schema/types.ts";
import * as s from "../schema/schema.ts";

export type Json =
	| JsonValue
	| JsonArray
	| JsonRecord;
export type JsonValue = string | number | boolean | null;
export type JsonArray = Array<Json>;
export type JsonRecord = { [key: string]: Json };

const JsonValueSchema: Schema<JsonValue> = s.union([
	s.string(),
	s.number(),
	s.boolean(),
	s.nill(),
]);
const JsonArraySchema: Schema<JsonArray> = s.lazy(() => s.array(JsonSchema));
const JsonRecordSchema: Schema<JsonRecord> = s.lazy(() => s.record(JsonSchema));
const JsonSchema: Schema<Json> = s.lazy(() =>
	s.union([JsonValueSchema, JsonArraySchema, JsonRecordSchema])
);

export function isJsonValue(value: unknown): value is JsonValue {
	return isSchema(JsonValueSchema, value);
}
export function isJsonArray(value: unknown): value is JsonArray {
	return isSchema(JsonArraySchema, value);
}
export function isJsonRecord(value: unknown): value is JsonRecord {
	return isSchema(JsonRecordSchema, value);
}
export function isJson(value: unknown): value is Json {
	return isSchema(JsonSchema, value);
}
export function assertJsonValue(value: unknown): asserts value is JsonValue {
	assertSchema(JsonValueSchema, value);
}
export function assertJsonArray(value: unknown): asserts value is JsonArray {
	assertSchema(JsonArraySchema, value);
}
export function assertJsonRecord(value: unknown): asserts value is JsonRecord {
	assertSchema(JsonRecordSchema, value);
}
export function assertJson(value: unknown): asserts value is Json {
	assertSchema(JsonSchema, value);
}
