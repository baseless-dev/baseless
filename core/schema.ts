// deno-lint-ignore-file no-explicit-any

import { type ID, isID } from "./id.ts";

export interface TSchema {
	type: string;
	$id?: string;
	title?: string;
	description?: string;
	default?: unknown;
	examples?: Array<unknown>;
	deprecated?: boolean;
}

export interface TID<TPrefix extends string> extends TSchema {
	type: "id";
	prefix: TPrefix;
}
export interface TString extends TSchema {
	type: "string";
}
export interface TNumber extends TSchema {
	type: "number";
}
export interface TBoolean extends TSchema {
	type: "boolean";
}
export interface TNull extends TSchema {
	type: "null";
}
export interface TAny extends TSchema {
	type: "any";
}
export interface TUndefined extends TSchema {
	type: "undefined";
}
export interface TUnknown extends TSchema {
	type: "unknown";
}
export interface TVoid extends TSchema {
	type: "void";
}
export interface TLiteral<TValue extends string | number | boolean> extends TSchema {
	type: "literal";
	value: TValue;
}
export interface TArray<TItems extends TSchema> extends TSchema {
	type: "array";
	items: TItems;
}
export interface TUnion<TTypes extends Array<TSchema>> extends TSchema {
	type: "union";
	types: TTypes;
}
export interface TRecord<TValue extends TSchema> extends TSchema {
	type: "record";
	value: TValue;
}
export interface TObject<
	TProperties extends { [key: string]: TSchema },
	TRequired extends Array<keyof TProperties>,
> extends TSchema {
	type: "object";
	properties: TProperties;
	required: TRequired;
	additionalProperties: boolean;
}
export interface TRecursive<TValue extends TSchema, TIdentifier extends string> extends TSchema {
	type: "recursive";
	identifier: TIdentifier;
	value: (self: TSelf<TIdentifier>) => TValue;
}
export interface TSelf<TIdentifier extends string> extends TSchema {
	type: "self";
	identifier: TIdentifier;
}

export function ID<TPrefix extends string>(
	prefix: TPrefix,
	options?: Omit<TSchema, "type">,
): TID<TPrefix> {
	return { ...options, type: "id", prefix };
}

export function String(options?: Omit<TSchema, "type">): TString {
	return { ...options, type: "string" };
}

export function Number(options?: Omit<TSchema, "type">): TNumber {
	return { ...options, type: "number" };
}

export function Boolean(options?: Omit<TSchema, "type">): TBoolean {
	return { ...options, type: "boolean" };
}

export function Null(options?: Omit<TSchema, "type">): TNull {
	return { ...options, type: "null" };
}

export function Any(options?: Omit<TSchema, "type">): TAny {
	return { ...options, type: "any" };
}

export function Undefined(options?: Omit<TSchema, "type">): TUndefined {
	return { ...options, type: "undefined" };
}

export function Unknown(options?: Omit<TSchema, "type">): TUnknown {
	return { ...options, type: "unknown" };
}

export function Void(options?: Omit<TSchema, "type">): TVoid {
	return { ...options, type: "void" };
}

export function Literal<TValue extends string | number | boolean>(
	literal: TValue,
	options?: Omit<TSchema, "type">,
): TLiteral<TValue> {
	return { ...options, type: "literal", value: literal };
}

export function Array<TItems extends TSchema>(
	items: TItems,
	options?: Omit<TSchema, "type">,
): TArray<TItems> {
	return { ...options, type: "array", items };
}

export function Union<const TTypes extends Array<TSchema>>(
	types: TTypes,
	options?: Omit<TSchema, "type">,
): TUnion<TTypes> {
	return { ...options, type: "union", types };
}

export function Record<TValue extends TSchema>(
	value: TValue,
	options?: Omit<TSchema, "type"> & { minProperties?: number; maxProperties?: number },
): TRecord<TValue> {
	return { ...options, type: "record", value };
}

export function Object<TProperties extends { [key: string]: TSchema }>(
	properties: TProperties,
	options?: Omit<TSchema, "type"> & { additionalProperties?: boolean },
): TObject<TProperties, []>;
export function Object<
	TProperties extends { [key: string]: TSchema },
	TRequired extends Array<keyof TProperties>,
>(
	properties: TProperties,
	required?: TRequired,
	options?: Omit<TSchema, "type"> & { additionalProperties?: boolean },
): TObject<TProperties, TRequired>;
export function Object(
	properties: any,
	requiredOrOptions: any,
	options?: Omit<TSchema, "type"> & { additionalProperties?: boolean },
): TObject<any, any> {
	return globalThis.Array.isArray(requiredOrOptions)
		? {
			...options,
			type: "object",
			properties,
			required: requiredOrOptions,
		}
		: {
			...requiredOrOptions,
			type: "object",
			properties,
			required: globalThis.Object.keys(properties),
		};
}

export function Recursive<TValue extends TSchema, TIdentifier extends string>(
	value: (self: TSelf<TIdentifier>) => TValue,
	identifier: TIdentifier,
	options?: Omit<TSchema, "type">,
): TRecursive<TValue, TIdentifier> {
	return { ...options, type: "recursive", identifier, value };
}

export function Index<TProperties extends { [key: string]: TSchema }, TIndex extends keyof TProperties>(
	value: TObject<TProperties, any>,
	index: TIndex,
): TProperties[TIndex] {
	return value.properties[index];
}

export type TPrimitive =
	| TID<string>
	| TString
	| TNumber
	| TBoolean
	| TNull
	| TUnknown
	| TAny
	| TUndefined
	| TVoid
	| TLiteral<string | number | boolean>
	| TArray<any>
	| TUnion<Array<any>>
	| TRecord<any>
	| TObject<Record<string, any>, Array<string>>
	| TRecursive<any, string>
	| TSelf<string>;

export type InArray<T, U extends any[]> = T extends U[number] ? T : never;
export type NotInArray<T, U extends any[]> = T extends U[number] ? never : T;
// deno-lint-ignore ban-types
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

// deno-fmt-ignore
type _Static<T, M extends Record<string, any>> =
	T extends TID<infer TPrefix> ? ID<TPrefix> :
	T extends TString ? string :
	T extends TNumber ? number :
	T extends TBoolean ? boolean :
	T extends TNull ? null :
	T extends TAny ? any :
	T extends TUndefined ? undefined :
	T extends TVoid ? void :
	T extends TUnknown ? unknown :
	T extends TLiteral<infer TConst> ? TConst :
	T extends TArray<infer TItems> ? Array<_Static<TItems, M>> :
	T extends TUnion<infer TTypes> ? _Static<TTypes[number], M> :
	T extends TRecord<infer TValue> ? Record<string, _Static<TValue, M>> :
	T extends TObject<infer TProperties, infer TRequired> ? Prettify<
			& { [K in keyof TProperties as InArray<K, TRequired>]-?: _Static<TProperties[K], M> }
			& { [K in keyof TProperties as NotInArray<K, TRequired>]?: _Static<TProperties[K], M> }
		> :
	// Cap recursion to 8 levels
	T extends TRecursive<infer TValue, infer TIdentifier> ? _Static<TValue, M & { [K in TIdentifier]: [[], TValue] }> :
	T extends TSelf<infer TIdentifier extends string> ?
		TIdentifier extends keyof M ?
			M[TIdentifier][0]["length"] extends 8 ?
				any :
				_Static<M[TIdentifier][1], Omit<M, TIdentifier> & { [K in TIdentifier]: [[1, ...M[TIdentifier][0]], M[TIdentifier][1]] }> :
			any :
	never;

// deno-lint-ignore ban-types
export type Static<T> = _Static<T, {}>;

export function validate<TValue extends TSchema>(
	schema: TValue,
	value: unknown,
	errors: Array<SchemaValidationError> = [],
): value is Static<TValue> {
	errors.splice(0, errors.length);
	function _appendErrorIfFalse(condition: boolean, errorCtor: () => SchemaValidationError): boolean {
		if (condition === false) {
			errors.push(errorCtor());
		}
		return condition;
	}
	function _appendInvalidSchemaError(condition: boolean, path: string[], type: TSchema): boolean {
		if (condition === false) {
			errors.push(new SchemaValidationError("Invalid schema", { path, type, cause: undefined }));
		}
		return condition;
	}
	function _validate<TValue extends TSchema>(
		schema: TPrimitive,
		value: unknown,
		path: string[],
		recursiveSchema: Record<string, TSchema | undefined> = {},
	): value is Static<TValue> {
		if ("type" in schema === false) {
			return _appendInvalidSchemaError(false, path, schema);
		}
		switch (schema.type) {
			case "id":
				return _appendInvalidSchemaError(isID(schema.prefix, value), path, schema);
			case "string":
				return _appendInvalidSchemaError(typeof value === "string", path, schema);
			case "number":
				return _appendInvalidSchemaError(typeof value === "number", path, schema);
			case "boolean":
				return _appendInvalidSchemaError(typeof value === "boolean", path, schema);
			case "null":
				return _appendInvalidSchemaError(value === null, path, schema);
			case "any":
				return _appendInvalidSchemaError(true, path, schema);
			case "undefined":
				return _appendInvalidSchemaError(value === undefined, path, schema);
			case "unknown":
				return _appendInvalidSchemaError(true, path, schema);
			case "void":
				return _appendInvalidSchemaError(value === undefined, path, schema);
			case "literal":
				return _appendInvalidSchemaError("value" in schema && value === schema.value, path, schema);
			case "array":
				return _appendInvalidSchemaError(
					globalThis.Array.isArray(value) === true &&
						"items" in schema &&
						value.every((item, idx) => _validate(schema.items, item, [...path, idx.toString()], recursiveSchema)),
					path,
					schema,
				);
			case "union":
				return _appendInvalidSchemaError(schema.types.some((type) => _validate(type, value, path, recursiveSchema)), path, schema);
			case "record":
				return _appendInvalidSchemaError(
					!!value && typeof value === "object" &&
						globalThis.Object.entries(value).every(([key, value]) => _validate(schema.value, value, [...path, key], recursiveSchema)),
					path,
					schema,
				);
			case "object":
				return _appendInvalidSchemaError(
					!!value && typeof value === "object" &&
						schema.required.every((p) => _appendErrorIfFalse(p in value, () => new MissingRequiredPropertyError([...path, p], schema))) &&
						globalThis.Object.entries(value).every(([key, value]) =>
							(key in schema.properties &&
								_validate(
									schema.required.includes(key) ? schema.properties[key] : Union([Any(), schema.properties[key]]),
									value,
									[...path, key],
									recursiveSchema,
								)) ||
							_appendErrorIfFalse(!(key in schema.properties) && schema.additionalProperties === true, () =>
								new InvalidAdditionalPropertyError([...path, key], schema))
						),
					path,
					schema,
				);
			case "recursive":
				return _validate(schema.value({ type: "self", identifier: schema.identifier }), value, path, {
					...recursiveSchema,
					[schema.identifier]: schema,
				});
			// deno-lint-ignore no-case-declarations
			case "self":
				const targetSchema = recursiveSchema[schema.identifier];
				if (!targetSchema) {
					return false;
				}
				return _validate(targetSchema as TPrimitive, value, path);
			default:
				return false;
		}
	}
	return _validate(schema as TPrimitive, value, ["$"]);
}

export function assert<TValue extends TSchema>(
	schema: TValue,
	value: unknown,
): asserts value is Static<TValue> {
	const errors: SchemaValidationError[] = [];
	if (!validate(schema, value, errors)) {
		throw new SchemaAssertionError(errors);
	}
}

export function toObject(schema: TSchema): Record<string, unknown> {
	function _toObject(schema: TPrimitive): Record<string, unknown> {
		if ("type" in schema === false) {
			return {};
		}
		switch (schema.type) {
			case "id":
				return { type: "id", prefix: schema.prefix };
			case "string":
				return { type: "string" };
			case "number":
				return { type: "number" };
			case "boolean":
				return { type: "boolean" };
			case "null":
				return { type: "null" };
			case "any":
				return { type: "any" };
			case "undefined":
				return { type: "undefined" };
			case "unknown":
				return { type: "unknown" };
			case "void":
				return { type: "void" };
			case "literal":
				return { type: "literal", value: schema.value };
			case "array":
				return { type: "array", items: _toObject(schema.items) };
			case "union":
				return { type: "union", types: schema.types.map((t) => _toObject(t)) };
			case "record":
				return { type: "record", value: _toObject(schema.value) };
			case "object":
				return {
					type: "object",
					properties: globalThis.Object.fromEntries(
						globalThis.Object.entries(schema.properties).map(([key, value]) => [key, _toObject(value)]),
					),
					required: schema.required,
				};
			case "recursive":
				return {
					type: "recursive",
					identifier: schema.identifier,
					value: _toObject(schema.value({ type: "self", identifier: schema.identifier })),
				};
			case "self":
				return { type: "self", identifier: schema.identifier };
			default:
				return {};
		}
	}
	return _toObject(schema as TPrimitive);
}

export function fromObject(schema: any): TSchema {
	function _fromObject(schema: any): TPrimitive {
		if (!schema || typeof schema !== "object" || "type" in schema === false) {
			throw new Error("Invalid schema");
		}
		switch (schema.type) {
			case "id":
				return ID(schema.prefix);
			case "string":
				return String();
			case "number":
				return Number();
			case "boolean":
				return Boolean();
			case "null":
				return Null();
			case "any":
				return Any();
			case "undefined":
				return Undefined();
			case "unknown":
				return Unknown();
			case "void":
				return Void();
			case "literal":
				return Literal(schema.value);
			case "array":
				return Array(_fromObject(schema.items));
			case "union":
				return Union(schema.types.map((t: any) => _fromObject(t)));
			case "record":
				return Record(_fromObject(schema.value));
			case "object":
				return Object(
					globalThis.Object.fromEntries(
						globalThis.Object.entries(schema.properties).map(([key, value]: [string, any]) => [key, _fromObject(value)]),
					),
					schema.required,
				);
			case "recursive":
				return Recursive((_self) => _fromObject(schema.value), schema.identifier);
			case "self":
				return { type: "self", identifier: schema.identifier };
			default:
				throw new Error("Invalid schema");
		}
	}
	return _fromObject(schema);
}

// deno-fmt-ignore
export function generateTypescriptFromSchema(schema: TSchema): [named: Map<string, string>, types: string] {
	const recursiveIdentifier = new Map<string, string>();
	function _generateTypescriptFromSchema(schema: TPrimitive): string {
		switch (schema.type) {
			case "id":
				return `ID<"${schema.prefix}">`;
			case "string":
				return "string";
			case "number":
				return "number";
			case "boolean":
				return "boolean";
			case "null":
				return "null";
			case "any":
				return "any";
			case "undefined":
				return "undefined";
			case "unknown":
				return "unknown";
			case "void":
				return "void";
			case "literal":
				return JSON.stringify(schema.value);
			case "array":
				return `Array<${_generateTypescriptFromSchema(schema.items)}>`;
			case "union":
				return schema.types.map((t) => _generateTypescriptFromSchema(t)).join(" | ");
			case "record":
				return `{[key: string]: ${_generateTypescriptFromSchema(schema.value)}}`;
			case "object":
				return `{${globalThis.Object.entries(schema.properties).map(([key, value]) => `${key}${schema.required?.includes(key) === true ? "" : "?"}: ${_generateTypescriptFromSchema(value)}`).join("; ")}}`;
			case "recursive": {
				const definition = _generateTypescriptFromSchema(schema.value({ type: "self", identifier: schema.identifier }));
				recursiveIdentifier.set(schema.identifier, definition);
				return schema.identifier;
			}
			case "self":
				return schema.identifier;
			default:
				return "never";
		}
	}
	const definition = _generateTypescriptFromSchema(schema as TPrimitive);
	return [recursiveIdentifier, definition];
}

// deno-fmt-ignore
export function generateSchemaFromSchema(schema: TSchema, ns = "Type"): string {
	const _schema = schema as TPrimitive;
	switch (_schema.type) {
		case "id":
			return `${ns}.TID<"${_schema.prefix}">`;
		case "string":
			return `${ns}.TString`;
		case "number":
			return `${ns}.TNumber`;
		case "boolean":
			return `${ns}.TBoolean`;
		case "null":
			return `${ns}.TNull`;
		case "any":
			return `${ns}.TAny`;
		case "undefined":
			return `${ns}.TUndefined`;
		case "unknown":
			return `${ns}.TUnknown`;
		case "void":
			return `${ns}.TVoid`;
		case "literal":
			return `${ns}.TLiteral<${JSON.stringify(_schema.value)}>`;
		case "array":
			return `${ns}.TArray<${generateSchemaFromSchema(_schema.items, ns)}>`;
		case "union":
			return `${ns}.TUnion<[${_schema.types.map((t) => generateSchemaFromSchema(t, ns)).join(", ")}]>`;
		case "record":
			return `${ns}.TRecord<${generateSchemaFromSchema(_schema.value, ns)}>`;
		case "object":
			return `${ns}.TObject<{${globalThis.Object.entries(_schema.properties).map(([key, value]) => `${key}: ${generateSchemaFromSchema(value)}`, ns).join("; ")}}, [${_schema.required.map(s => JSON.stringify(s)).join(", ")}]>`;
		case "recursive": {
			return `${ns}.TRecursive<${generateSchemaFromSchema(_schema.value({ type: "self", identifier: _schema.identifier }), ns)}, ${JSON.stringify(_schema.identifier)}>`;
		}
		case "self":
			return `${ns}.TSelf<${JSON.stringify(_schema.identifier)}>`;
		default:
			throw new Error("Invalid schema");
	}
}

export class SchemaValidationError extends Error {
	path: string[];
	type: TSchema;
	constructor(message: string, options: { path: string[]; type: TSchema; cause: unknown }) {
		super(message, { cause: options.cause });
		this.path = [...options.path];
		this.type = options.type;
	}
}

export class MissingRequiredPropertyError extends SchemaValidationError {
	constructor(path: string[], type: TSchema, cause?: unknown) {
		super("Missing required property", { path, type, cause });
	}
}

export class InvalidAdditionalPropertyError extends SchemaValidationError {
	constructor(path: string[], type: TSchema, cause?: unknown) {
		super("Invalid additional property", { path, type, cause });
	}
}

export class SchemaAssertionError extends Error {
	errors: SchemaValidationError[];
	constructor(errors: SchemaValidationError[], cause?: unknown) {
		super(`Schema assertion error`, { cause });
		this.errors = [...errors];
	}
}
