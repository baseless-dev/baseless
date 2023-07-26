import type { Infer, Schema } from "./types.ts";
import type { Validator } from "./validator.ts";

export function nill(
	msg?: string,
): Schema<null> {
	return {
		kind: "nill",
		msg,
		validate(value): value is null {
			return value === null;
		},
	};
}

export function undef(
	msg?: string,
): Schema<undefined> {
	return {
		kind: "undef",
		msg,
		validate(value): value is undefined {
			return value === undefined;
		},
	};
}

export function string(
	validators: Validator[] = [],
	msg?: string,
): Schema<string> {
	return {
		kind: "string",
		msg,
		validate(value): value is string {
			return typeof value === "string" &&
				validators.every((validator) => validator.validate(value));
		},
	};
}

export function number(
	validators: Validator[] = [],
	msg?: string,
): Schema<number> {
	return {
		kind: "number",
		msg,
		validate(value): value is number {
			return typeof value === "number" &&
				validators.every((validator) => validator.validate(value));
		},
	};
}

export function boolean(
	validators: Validator[] = [],
	msg?: string,
): Schema<boolean> {
	return {
		kind: "boolean",
		msg,
		validate(value): value is boolean {
			return typeof value === "boolean" &&
				validators.every((validator) => validator.validate(value));
		},
	};
}

export function date(
	validators: Validator[] = [],
	msg?: string,
): Schema<Date> {
	return {
		kind: "date",
		msg,
		validate(value): value is Date {
			return !!value && value instanceof Date &&
				validators.every((validator) => validator.validate(value));
		},
	};
}

export function array<TItem extends Schema<unknown> = never>(
	item: TItem,
	validators: Validator[] = [],
	msg?: string,
): Schema<NonNullable<Infer<TItem>>> {
	return {
		kind: "array",
		item,
		msg,
		validate(value): value is NonNullable<Infer<TItem>> {
			return !!value && Array.isArray(value) &&
				validators.every((validator) => validator.validate(value));
		},
		*children(
			value,
		): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
			if (!!value && Array.isArray(value)) {
				for (const [key, val] of value.entries()) {
					yield [`[${key}]`, val, item];
				}
			}
		},
	};
}

export function record<TItem extends Schema<unknown> = never>(
	item: TItem,
	validators: Validator[] = [],
	msg?: string,
): Schema<Record<string, Infer<TItem>>> {
	return {
		kind: "record",
		item,
		msg,
		validate(value): value is Record<string, Infer<TItem>> {
			return !!value && typeof value === "object" &&
				validators.every((validator) => validator.validate(value));
		},
		*children(
			value,
		): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
			if (!!value && typeof value === "object") {
				for (const [key, val] of Object.entries(value)) {
					yield [`[${key}]`, val, item];
				}
			}
		},
	};
}

export function object<TObject extends Record<string, Schema<unknown>> = never>(
	object: TObject,
	validators: Validator[] = [],
	msg?: string,
): Schema<{ [K in keyof TObject]: Infer<TObject[K]> }> {
	return {
		kind: "object",
		object,
		msg,
		validate(value): value is { [K in keyof TObject]: Infer<TObject[K]> } {
			return !!value && typeof value === "object" &&
				validators.every((validator) => validator.validate(value));
		},
		*children(
			value,
		): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
			// if (!!value && typeof value === "object") {
			// 	for (const [key, val] of Object.entries(value)) {
			// 		if (key in object) {
			// 		yield [`[${key}]`, val, item];
			// 	}
			// }
		},
	};
}
