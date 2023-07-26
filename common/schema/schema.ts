// deno-lint-ignore-file explicit-function-return-type
import type { Validator } from "./validator.ts";

export type Schema = {
	readonly kind: string;
	readonly msg?: string;
	parse(value: unknown, path: string): void;
};
export class ParseError extends Error {
	constructor(
		public readonly path: string,
		public readonly msg?: string,
		public readonly causes?: ParseError[],
	) {
		super(
			`Parse error${path ? ` at ${path}` : ""}${msg ? `, ${msg}.` : ""}`,
		);
	}
}
export type NullSchema = Schema & { readonly kind: "null" };
export type UndefinedSchema = Schema & { readonly kind: "undefined" };
export type AnySchema = Schema & { readonly kind: "any" };
export type BooleanSchema = Schema & {
	readonly kind: "boolean";
	readonly validators?: Validator[];
};
export type NumberSchema = Schema & {
	readonly kind: "number";
	readonly validators?: Validator[];
};
export type StringSchema = Schema & {
	readonly kind: "string";
	readonly validators?: Validator[];
};
export type DateSchema = Schema & {
	readonly kind: "date";
	readonly validators?: Validator[];
};
export type ObjectSchema<
	TObject extends Record<string, Schema> = Record<never, never>,
> = Schema & {
	readonly kind: "object";
	readonly object: TObject;
};
export type RecordSchema<
	TRecord extends Schema = never,
> = Schema & {
	readonly kind: "record";
	readonly record: TRecord;
	readonly validators?: Validator[];
};
export type ArraySchema<TItem extends Schema = never> = Schema & {
	readonly kind: "array";
	readonly item: TItem;
	readonly validators?: Validator[];
};
export type OptionalSchema<TSchema extends Schema = never> = Schema & {
	readonly kind: "optional";
	readonly schema: TSchema;
};
export type EnumSchema<TValues extends readonly string[] = never[]> =
	& Schema
	& {
		readonly kind: "enum";
		readonly values: TValues;
	};
export type LiteralSchema<TValue extends string | number | boolean = never> =
	& Schema
	& {
		readonly kind: "literal";
		readonly value: TValue;
	};
export type UnionSchema<TShapes extends readonly Schema[] = never[]> =
	& Schema
	& {
		readonly kind: "union";
		readonly shapes: TShapes;
	};

export function nill(msg?: string): NullSchema {
	return {
		kind: "null",
		msg,
		parse(value, path) {
			if (value !== null) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function undef(msg?: string): UndefinedSchema {
	return {
		kind: "undefined",
		msg,
		parse(value, path) {
			if (value !== undefined) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function any(msg?: string): AnySchema {
	return {
		kind: "any",
		msg,
		parse(_value) {
		},
	};
}
export function boolean(validators?: Validator[], msg?: string): BooleanSchema {
	return {
		kind: "boolean",
		msg,
		validators,
		parse(value, path) {
			if (
				typeof value !== "boolean" ||
				!(this.validators ?? []).every((v) => v.validate(value))
			) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function number(validators?: Validator[], msg?: string): NumberSchema {
	return {
		kind: "number",
		msg,
		validators,
		parse(value, path) {
			if (
				typeof value !== "number" ||
				!(this.validators ?? []).every((v) => v.validate(value))
			) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function string(validators?: Validator[], msg?: string): StringSchema {
	return {
		kind: "string",
		msg,
		validators,
		parse(value, path) {
			if (
				typeof value !== "string" ||
				!(this.validators ?? []).every((v) => v.validate(value))
			) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function date(validators?: Validator[], msg?: string): DateSchema {
	return {
		kind: "date",
		msg,
		validators,
		parse(value, path) {
			if (
				!(value instanceof Date) ||
				!(this.validators ?? []).every((v) => v.validate(value))
			) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function object<TObject extends Record<string, Schema>>(
	object: TObject,
	msg?: string,
): ObjectSchema<TObject> {
	return {
		kind: "object",
		object,
		msg,
		parse(value, path) {
			if (
				!value || typeof value !== "object"
				// TODO more/missing keys in value
			) {
				throw new ParseError(path, this.msg);
			}

			const errors: ParseError[] = [];
			for (const [key, schema] of Object.entries(object)) {
				try {
					schema.parse(value[key as keyof typeof value], `${path}.${key}`);
				} catch (error) {
					errors.push(error);
				}
			}
			if (errors.length > 0) {
				throw new ParseError(path, this.msg, errors);
			}
		},
	};
}
export function record<TRecord extends Schema>(
	record: TRecord,
	validators?: Validator[],
	msg?: string,
): RecordSchema<TRecord> {
	return {
		kind: "record",
		record,
		validators,
		msg,
		parse(value, path) {
			if (
				!value || typeof value !== "object" ||
				!(this.validators ?? []).every((v) => v.validate(value))
			) {
				throw new ParseError(path, this.msg);
			}
			const errors: ParseError[] = [];
			for (const [key, value] of Object.entries(object)) {
				try {
					record.parse(value, `${path}.${key}`);
				} catch (error) {
					errors.push(error);
				}
			}
			if (errors.length > 0) {
				throw new ParseError(path, this.msg, errors);
			}
		},
	};
}
export function array<TItem extends Schema>(
	item: TItem,
	validators?: Validator[],
	msg?: string,
): ArraySchema<TItem> {
	return {
		kind: "array",
		item,
		validators,
		msg,
		parse(value, path) {
			if (
				!value || !Array.isArray(value) ||
				!(this.validators ?? []).every((v) => v.validate(value))
			) {
				throw new ParseError(path, this.msg);
			}
			const errors: ParseError[] = [];
			for (const [i, v] of value.entries()) {
				try {
					item.parse(v, `${path}[${i}]`);
				} catch (error) {
					errors.push(error);
				}
			}
			if (errors.length > 0) {
				throw new ParseError(path, this.msg, errors);
			}
		},
	};
}
export function optional<TSchema extends Schema>(
	schema: TSchema,
	msg?: string,
): OptionalSchema<TSchema> {
	return {
		kind: "optional",
		schema,
		msg,
		parse(value, path) {
			if (value !== undefined) {
				schema.parse(value, path);
			}
		},
	};
}
export function enumType<const TValues extends readonly string[]>(
	values: TValues,
	msg?: string,
): EnumSchema<TValues> {
	return {
		kind: "enum",
		values,
		msg,
		parse(value, path) {
			if (typeof value !== "string" || !values.includes(value)) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function literal<const TValue extends string | number | boolean>(
	value: TValue,
	msg?: string,
): LiteralSchema<TValue> {
	return {
		kind: "literal",
		value,
		msg,
		parse(value, path) {
			if (
				!(typeof value === "string" || typeof value === "number" ||
					typeof value === "boolean") ||
				value !== this.value
			) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}
export function union<const TShapes extends readonly Schema[]>(
	shapes: TShapes,
	msg?: string,
): UnionSchema<TShapes> {
	return {
		kind: "union",
		shapes,
		msg,
		parse(value, path) {
			if (!shapes.some((v) => v.parse(value, path))) {
				throw new ParseError(path, this.msg);
			}
		},
	};
}

export type Infer<TSchema extends Schema> = TSchema extends NullSchema ? null
	: TSchema extends UndefinedSchema ? undefined
	// deno-lint-ignore no-explicit-any
	: TSchema extends AnySchema ? any
	: TSchema extends BooleanSchema ? boolean
	: TSchema extends NumberSchema ? number
	: TSchema extends StringSchema ? string
	: TSchema extends DateSchema ? Date
	: TSchema extends ObjectSchema<infer TObject>
		? { [K in keyof TObject]: Infer<TObject[K]> }
	: TSchema extends RecordSchema<infer TRecord> ? Record<string, Infer<TRecord>>
	: TSchema extends ArraySchema<infer TItem> ? Infer<TItem>[]
	: TSchema extends OptionalSchema<infer TWrappedSchema>
		? Infer<TWrappedSchema> | undefined
	: TSchema extends EnumSchema<infer TValues> ? TValues[number]
	: TSchema extends LiteralSchema<infer TValue> ? TValue
	: TSchema extends UnionSchema<infer TSchema> ? Infer<TSchema[number]>
	: never;
