import { type Schema } from "../schema/types.ts";
import * as s from "../schema/schema.ts";

// Type definitions are nessary because TypeScript can't infer recursive
// types yet.
export type Json = JsonValue | JsonArray | JsonRecord;
export type JsonValue = string | number | boolean | null;
export type JsonArray = Array<Json>;
export type JsonRecord = { [key: string]: Json };

export const JsonValueSchema: Schema<"union", JsonValue> = s.union([
	s.string(),
	s.number(),
	s.boolean(),
	s.nill(),
]);
export const JsonArraySchema: Schema<"array", JsonArray> = s.lazy(() =>
	s.array(JsonSchema)
);
export const JsonRecordSchema: Schema<"record", JsonRecord> = s.lazy(() =>
	s.record(JsonSchema)
);
export const JsonSchema: Schema<"union", Json> = s.lazy(() =>
	s.union([JsonValueSchema, JsonArraySchema, JsonRecordSchema])
);
