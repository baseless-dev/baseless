import {
	type Infer,
	isArraySchema,
	isBooleanSchema,
	isConstSchema,
	isEnumSchema,
	isNullSchema,
	isNumberSchema,
	isObjectSchema,
	isRecordSchema,
	isSetSchema,
	isStringSchema,
	isTupleSchema,
	isUnionSchema,
	type Schema,
} from "./types.ts";

export function CheckJIT(schema: Schema, value: unknown): value is unknown;
export function CheckJIT<TSchema extends Schema>(
	schema: TSchema,
	value: unknown,
): value is Infer<TSchema>;
export function CheckJIT(schema: Schema, value: unknown): boolean {
	if ("type" in schema && schema.type === "null") {
		return value === null;
	}
	if ("type" in schema && schema.type === "boolean") {
		return typeof value === "boolean";
	}
	if ("type" in schema && schema.type === "number") {
		return typeof value === "number" &&
			(schema.multipleOf === undefined || value % schema.multipleOf === 0) &&
			(schema.minimum === undefined ||
				(schema.exclusiveMinimum === true
					? value >= schema.minimum
					: value > schema.minimum)) &&
			(schema.maximum === undefined ||
				(schema.exclusiveMaximum === true
					? value <= schema.maximum
					: value < schema.maximum));
	}
	if ("type" in schema && schema.type === "string") {
		return typeof value === "string" &&
			(schema.maxLength === undefined || value.length <= schema.maxLength) &&
			(schema.minLength === undefined || value.length >= schema.minLength) &&
			(schema.pattern === undefined || new RegExp(schema.pattern).test(value));
		// TODO https://json-schema.org/draft/2020-12/json-schema-validation#section-7.3
	}
	if ("enum" in schema && Array.isArray(schema.enum)) {
		// deno-lint-ignore no-explicit-any
		return schema.enum.includes(value as any);
	}
	if ("const" in schema && typeof schema.const === "string") {
		return schema.const === value;
	}
	if (
		"type" in schema && schema.type === "array" && "prefixItems" in schema &&
		Array.isArray(schema.prefixItems)
	) {
		return !!value && Array.isArray(value) &&
			value.length === schema.prefixItems.length &&
			value.every((value, index) => CheckJIT(schema.prefixItems[index], value));
	}
	if (
		"type" in schema && schema.type === "array" && "items" in schema &&
		Array.isArray(schema.items) && !("uniqueItems" in schema)
	) {
		return !!value && Array.isArray(value) && value.every((value) =>
			CheckJIT(schema.items, value)
		) &&
			(schema.minItems === undefined || value.length >= schema.minItems) &&
			(schema.maxItems === undefined || value.length <= schema.maxItems);
	}
	if (
		"type" in schema && schema.type === "array" && "items" in schema &&
		Array.isArray(schema.items) && "uniqueItems" in schema &&
		schema.uniqueItems === true
	) {
		return !!value && Array.isArray(value) && value.every((value) =>
			CheckJIT(schema.items, value)
		) &&
			(schema.minItems === undefined || value.length >= schema.minItems) &&
			(schema.maxItems === undefined || value.length <= schema.maxItems) &&
			(schema.uniqueItems === undefined ||
				value.length === new Set(value).size);
	}
	if (
		"type" in schema && schema.type === "object" && "properties" in schema &&
		(!("required" in schema) || Array.isArray(schema.required))
	) {
		return !!value && typeof value === "object" &&
			(schema.required === undefined ||
				schema.required.every((key) =>
					key in value && (value as any)[key] !== undefined
				)) &&
			Object.entries(value).every(([key, value]) =>
				key in schema.properties && CheckJIT(schema.properties[key], value)
			);
	}
	if (
		"type" in schema && schema.type === "object" &&
		"patternProperties" in schema
	) {
		return !!value && typeof value === "object" &&
			Object.entries(value).every((value) =>
				CheckJIT(schema.patternProperties[".*"], value)
			) &&
			(schema.minProperties === undefined ||
				Object.keys(value).length >= schema.minProperties) &&
			(schema.maxProperties === undefined ||
				Object.keys(value).length <= schema.maxProperties);
	}
	if ("oneOf" in schema && Array.isArray(schema.oneOf)) {
		return schema.oneOf.some((schema) => CheckJIT(schema, value));
	}
	return false;
}

export function Code(schema: Schema, value = "value"): string {
	if (isNullSchema(schema)) {
		return `${value} === null`;
	}
	if (isBooleanSchema(schema)) {
		return `typeof ${value} === "boolean"`;
	}
	if (isNumberSchema(schema)) {
		return [
			`typeof ${value} === "number"`,
			typeof schema.multipleOf !== "undefined"
				? `${value} % ${schema.multipleOf} === 0`
				: "",
			typeof schema.minimum !== "undefined"
				? schema.exclusiveMinimum === true
					? `${value} >= ${schema.minimum}`
					: `${value} > ${schema.minimum}`
				: "",
			typeof schema.maximum !== "undefined"
				? schema.exclusiveMaximum === true
					? `${value} <= ${schema.maximum}`
					: `${value} < ${schema.maximum}`
				: "",
		].filter((f) => f).join(" && ");
	}
	if (isStringSchema(schema)) {
		return [
			`typeof ${value} === "string"`,
			typeof schema.minLength !== "undefined" ||
				typeof schema.maxLength !== "undefined"
				? `($0 = ${value}.length, 1)`
				: "",
			typeof schema.minLength !== "undefined"
				? `$0 >= ${schema.minLength}`
				: "",
			typeof schema.maxLength !== "undefined"
				? `$0 <= ${schema.maxLength}`
				: "",
			typeof schema.pattern !== "undefined"
				? `new RegExp("${schema.pattern}").test(${value})`
				: "",
			// TODO https://json-schema.org/draft/2020-12/json-schema-validation#section-7.3
		].filter((f) => f).join(" && ");
	}
	if (isEnumSchema(schema)) {
		return `${JSON.stringify(schema.enum)}.includes(${value})`;
	}
	if (isConstSchema(schema)) {
		return `${value} === ${JSON.stringify(schema.const)}`;
	}
	if (isTupleSchema(schema)) {
		return [
			`Array.isArray(${value})`,
			`${value}.length === ${schema.prefixItems.length}`,
			...schema.prefixItems.map((schema, index) =>
				Code(schema, `${value}[${index}]`)
			),
		].filter((f) => f).join(" && ");
	}
	if (isArraySchema(schema)) {
		return [
			`Array.isArray(${value})`,
			typeof schema.minItems !== "undefined" ||
				typeof schema.maxItems !== "undefined"
				? `($0 = ${value}.length, 1)`
				: "",
			typeof schema.minItems !== "undefined" ? `$0 >= ${schema.minItems}` : "",
			typeof schema.maxItems !== "undefined" ? `$0 <= ${schema.maxItems}` : "",
			`${value}.every(v => ${Code(schema.items, `v`)})`,
		].filter((f) => f).join(" && ");
	}
	if (isSetSchema(schema)) {
		return [
			`Array.isArray(${value})`,
			`($0 = ${value}.length, 1)`,
			typeof schema.minItems !== "undefined" ? `$0 >= ${schema.minItems}` : "",
			typeof schema.maxItems !== "undefined" ? `$0 <= ${schema.maxItems}` : "",
			`$0 === new Set(${value}).size`,
			`${value}.every(v => ${Code(schema.items, `v`)})`,
		].filter((f) => f).join(" && ");
	}
	if (isObjectSchema<Record<string, Schema>>(schema)) {
		return [
			`typeof ${value} === "object"`,
			...schema.required?.map((key) => `"${key}" in ${value}`) ?? [],
			...Object.entries(schema.properties).map(([key, propSchema]) => {
				const isRequired = schema.required?.includes(key) === true;
				// deno-fmt-ignore
				return (
					(!isRequired ? `(!("${key}" in ${value}) || ${value}["${key}"] === undefined || (` : ``) +
					Code(propSchema, `${value}["${key}"]`) + 
					(!isRequired ? `))` : ``)
				);
			}),
		].filter((f) => f).join(" && ");
	}
	if (isRecordSchema(schema)) {
		return [
			`typeof ${value} === "object"`,
			`Object.values(${value}).every(v => ${
				Code(schema.patternProperties[".*"], `v`)
			})`,
			typeof schema.minProperties !== "undefined" ||
				typeof schema.maxProperties !== "undefined"
				? `($0 = Object.keys(${value}).length, 1)`
				: "",
			typeof schema.minProperties !== "undefined"
				? `$0 >= ${schema.minProperties}`
				: "",
			typeof schema.maxProperties !== "undefined"
				? `$0 <= ${schema.maxProperties}`
				: "",
		].filter((f) => f).join(" && ");
	}
	if (isUnionSchema(schema)) {
		return schema.oneOf.map((schema) => `(${Code(schema, value)})`).join(
			" || ",
		);
	}
	return `false`;
}

const compiledSchemaCache: WeakMap<Schema, (value: unknown) => boolean> =
	new WeakMap();

export function Compile<TSchema extends Schema>(
	schema: TSchema,
): (value: unknown) => value is Infer<TSchema> {
	let compiledSchema = compiledSchemaCache.get(schema);
	if (!compiledSchema) {
		if ("eval" in globalThis) {
			compiledSchema = new Function(
				"value",
				`let $0; return ${Code(schema)}`,
			) as (value: unknown) => boolean;
		} else {
			compiledSchema = (value: unknown): boolean => CheckJIT(schema, value);
		}
		compiledSchemaCache.set(schema, compiledSchema);
	}
	return compiledSchema as (value: unknown) => value is Infer<TSchema>;
}

export function Check(schema: Schema, value: unknown): value is unknown;
export function Check<TSchema extends Schema>(
	schema: TSchema,
	value: unknown,
): value is Infer<TSchema>;
export function Check(
	schema: Schema,
	value: unknown,
): boolean {
	return Compile(schema)(value);
}
export function Assert(
	schema: Schema,
	value: unknown,
): asserts value is unknown;
export function Assert<TSchema extends Schema>(
	schema: TSchema,
	value: unknown,
): asserts value is Infer<TSchema>;
export function Assert(
	schema: Schema,
	value: unknown,
): void {
	if (!Check(schema, value)) {
		throw new Error("Assertion failed!");
	}
}
