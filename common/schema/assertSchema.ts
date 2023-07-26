import type { Infer, Schema } from "./schema.ts";

export default function assertSchema<TSchema extends Schema>(
	schema: TSchema,
	value?: unknown,
): asserts value is Infer<TSchema> {
	schema.parse(value, "");
}
