import type { Pretty } from "../system/types.ts";

// deno-lint-ignore-file
export interface BaseSchema {
	$id?: string;
	description?: string;
}

export interface NullSchema extends BaseSchema {
	type: "null";
}

export function isNullSchema(value: unknown): value is NullSchema {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "null";
}

export function Null(): NullSchema {
	return { type: "null" };
}

export interface BooleanSchema extends BaseSchema {
	type: "boolean";
}

export function isBooleanSchema(
	value: unknown,
): value is BooleanSchema {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "boolean";
}

export function Boolean(): BooleanSchema {
	return { type: "boolean" };
}

export interface NumberSchema extends BaseSchema {
	type: "number";
	multipleOf?: number;
	maximum?: number;
	exclusiveMaximum?: boolean;
	minimum?: number;
	exclusiveMinimum?: boolean;
}

export function isNumberSchema(
	value: unknown,
): value is NumberSchema {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "number" &&
		(!("multipleOf" in value) || typeof value.multipleOf === "number") &&
		(!("maximum" in value) || typeof value.maximum === "number") &&
		(!("exclusiveMaximum" in value) ||
			typeof value.exclusiveMaximum === "boolean") &&
		(!("minimum" in value) || typeof value.minimum === "number") &&
		(!("exclusiveMinimum" in value) ||
			typeof value.exclusiveMinimum === "boolean");
}

export function Number(
	options?: Omit<NumberSchema, "type">,
): NumberSchema {
	return { ...options, type: "number" };
}

export interface StringSchema extends BaseSchema {
	type: "string";
	maxLength?: number;
	minLength?: number;
	pattern?: string;
	format?: string;
}

export function isStringSchema(
	value: unknown,
): value is StringSchema {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "string" &&
		(!("maxLength" in value) || typeof value.maxLength === "number") &&
		(!("minLength" in value) || typeof value.minLength === "number") &&
		(!("pattern" in value) || typeof value.pattern === "string") &&
		(!("format" in value) || typeof value.format === "string");
}

export function String(
	options?: Omit<StringSchema, "type">,
): StringSchema {
	return { ...options, type: "string" };
}

export interface EnumSchema<TValues extends string[] = string[]>
	extends BaseSchema {
	enum: TValues;
}

export function isEnumSchema<TValues extends string[] = []>(
	value: unknown,
): value is EnumSchema<TValues> {
	return !!value && typeof value === "object" && "enum" in value &&
		typeof value.enum === "object" && !!value.enum &&
		globalThis.Array.isArray(value.enum) &&
		value.enum.every((value) => typeof value === "string");
}

export function Enum<const T extends string[]>(
	...values: T
): EnumSchema<T> {
	return { enum: values };
}

export interface ConstSchema<
	TConst extends boolean | string | number = string,
> extends BaseSchema {
	const: TConst;
}

export function isConstSchema<TConst extends boolean | string | number>(
	value: unknown,
): value is ConstSchema<TConst> {
	return !!value && typeof value === "object" && "const" in value &&
		typeof value.const === "string";
}

export function Const<const T extends boolean | string | number>(
	value: T,
): ConstSchema<T> {
	return { const: value };
}

export interface TupleSchema<TItems extends Schema[] = Schema[]>
	extends BaseSchema {
	type: "array";
	prefixItems: TItems;
}

export function isTupleSchema<TItems extends Schema[] = []>(
	value: unknown,
): value is TupleSchema<TItems> {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "array" &&
		"prefixItems" in value && typeof value.prefixItems === "object" &&
		!!value.prefixItems &&
		globalThis.Array.isArray(value.prefixItems) &&
		value.prefixItems.every(isSchema);
}

export function Tuple<const TItems extends Schema[]>(
	prefixItems: TItems,
): TupleSchema<TItems> {
	return { type: "array", prefixItems };
}

export interface ArraySchema<TItems extends Schema = Schema>
	extends BaseSchema {
	type: "array";
	items: TItems;
	maxItems?: number;
	minItems?: number;
}

export function isArraySchema<
	TItems extends Schema = NullSchema,
>(
	value: unknown,
): value is ArraySchema<TItems> {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "array" &&
		"items" in value && isSchema(value.items) &&
		(!("uniqueItems" in value) || value.uniqueItems === false) &&
		(!("maxItems" in value) || typeof value.maxItems === "number") &&
		(!("minItems" in value) || typeof value.minItems === "number");
}

export function Array<const TItems extends Schema>(
	items: TItems,
	options?: Omit<ArraySchema<any>, "type" | "items">,
): ArraySchema<TItems> {
	return { ...options, type: "array", items };
}

export interface SetSchema<TItems extends Schema = Schema> extends BaseSchema {
	type: "array";
	items: TItems;
	maxItems?: number;
	minItems?: number;
	uniqueItems: true;
}

export function isSetSchema<
	TItems extends Schema = NullSchema,
>(
	value: unknown,
): value is SetSchema<TItems> {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "array" &&
		"items" in value && isSchema(value.items) &&
		"uniqueItems" in value && value.uniqueItems === true &&
		(!("maxItems" in value) || typeof value.maxItems === "number") &&
		(!("minItems" in value) || typeof value.minItems === "number");
}

export function Set<const TItems extends Schema>(
	items: TItems,
	options?: Omit<SetSchema<any>, "type" | "items">,
): SetSchema<TItems> {
	return { ...options, type: "array", items, uniqueItems: true };
}

export interface ObjectSchema<
	TProperties extends Record<string, Schema> = Record<string, Schema>,
	TRequired extends Array<keyof TProperties> = Array<keyof TProperties>,
> extends BaseSchema {
	type: "object";
	properties: TProperties;
	required?: TRequired;
}

export function isObjectSchema<
	TProperties extends Record<string, Schema> = Record<string, Schema>,
>(
	value: unknown,
): value is ObjectSchema<TProperties, Array<keyof TProperties>> {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "object" &&
		"properties" in value && typeof value.properties === "object" &&
		!!value.properties &&
		globalThis.Object.values(value.properties).every(isSchema) &&
		(!("required" in value) ||
			globalThis.Array.isArray(value.required) &&
				value.required.every((key) => typeof key === "string"));
}

export function Object<TProperties extends Record<string, Schema>>(
	properties: TProperties,
): ObjectSchema<TProperties, []>;
export function Object<
	TProperties extends Record<string, Schema>,
	const TRequired extends Array<keyof TProperties>,
>(
	properties: TProperties,
	required: TRequired,
): ObjectSchema<TProperties, TRequired>;
export function Object(
	properties: any,
	required: any = [],
): ObjectSchema<any, any> {
	return { type: "object", properties, required };
}

export interface RecordSchema<TItems extends Schema = Schema>
	extends BaseSchema {
	type: "object";
	patternProperties: Record<string, TItems>;
	minProperties?: number;
	maxProperties?: number;
}

export function isRecordSchema<
	TItems extends Schema = NullSchema,
>(
	value: unknown,
): value is RecordSchema<TItems> {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "object" &&
		"patternProperties" in value && !!value.patternProperties &&
		globalThis.Object.values(value.patternProperties).every(isSchema) &&
		(!("minProperties" in value) || typeof value.minProperties === "number") &&
		(!("maxProperties" in value) || typeof value.maxProperties === "number");
}

export function Record<const TItems extends Schema>(
	items: TItems,
	options?: Omit<RecordSchema<any>, "type" | "patternProperties">,
): RecordSchema<TItems> {
	return { ...options, type: "object", patternProperties: { ".*": items } };
}

export interface UnionSchema<TTypes extends Schema[] = Schema[]>
	extends BaseSchema {
	oneOf: TTypes;
}

export function isUnionSchema<TTypes extends Schema[] = []>(
	value: unknown,
): value is UnionSchema<TTypes> {
	return !!value && typeof value === "object" && "oneOf" in value &&
		!!value.oneOf &&
		globalThis.Array.isArray(value.oneOf) && value.oneOf.every(isSchema);
}

export function Union<const TTypes extends Schema[]>(
	...types: TTypes
): UnionSchema<TTypes> {
	return { oneOf: types };
}

export function Referenceable<const TSchema extends Schema>(
	id: string,
	schema: TSchema,
): TSchema {
	return {
		...schema,
		"$id": id,
	};
}

export function Describe<const TSchema extends BaseSchema>(
	description: string,
	schema: TSchema,
): TSchema {
	return {
		...schema,
		description,
	};
}

export type Schema =
	| NullSchema
	| BooleanSchema
	| NumberSchema
	| StringSchema
	| EnumSchema
	| ConstSchema
	| TupleSchema
	| ArraySchema
	| SetSchema
	| ObjectSchema
	| RecordSchema
	| UnionSchema;

function isSchema(value: unknown): value is Schema {
	return isNullSchema(value) ||
		isBooleanSchema(value) ||
		isNumberSchema(value) ||
		isStringSchema(value) ||
		isEnumSchema(value) ||
		isConstSchema(value) ||
		isTupleSchema(value) ||
		isArraySchema(value) ||
		isSetSchema(value) ||
		isObjectSchema(value) ||
		isRecordSchema(value) ||
		isUnionSchema(value);
}

export type Infer<T> = T extends NullSchema ? null
	: T extends BooleanSchema ? boolean
	: T extends NumberSchema ? number
	: T extends StringSchema ? string
	: T extends EnumSchema<infer TValues> ? TValues[number]
	: T extends ConstSchema<infer TConst> ? TConst
	: T extends TupleSchema<infer TPrefixItems>
		? { [K in keyof TPrefixItems]: Infer<TPrefixItems[K]> }
	: T extends ArraySchema<infer TItem> ? Infer<TItem>[]
	: T extends ObjectSchema<infer TObject, infer TRequired> ? Pretty<
			& { [K in keyof TObject]?: Infer<TObject[K]> }
			& { [K in TRequired[number]]: Infer<TObject[K]> }
		>
	: T extends RecordSchema<infer TItem> ? Record<string, Infer<TItem>>
	: T extends UnionSchema<infer TTypes> ? Infer<TTypes[number]>
	: {};
