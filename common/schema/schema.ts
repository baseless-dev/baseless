import {
	globalSchemaRegistry,
	type Infer,
	type Schema,
	type Validator,
} from "./types.ts";

export function nill(): Schema<null> {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "nill" } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof nill>>("nill", {
	validate(_schema, value): value is null {
		return value === null;
	},
});

export function undef(): Schema<undefined> {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "undef" } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof undef>>("undef", {
	validate(_schema, value): value is undefined {
		return value === undefined;
	},
});

export function string(
	validators: Validator[] = [],
): Schema<string> {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "string", validators } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof string>>("string", {
	validate(_schema, value): value is string {
		return typeof value === "string";
	},
});

export function number(
	validators: Validator[] = [],
): Schema<number> {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "number", validators } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof number>>("number", {
	validate(_schema, value): value is number {
		return typeof value === "number";
	},
});

export function boolean(
	validators: Validator[] = [],
): Schema<boolean> {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "boolean", validators } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof boolean>>("boolean", {
	validate(_schema, value): value is boolean {
		return typeof value === "boolean";
	},
});

export function date(
	validators: Validator[] = [],
): Schema<Date> {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "date", validators } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof date>>("date", {
	validate(_schema, value): value is Date {
		return !!value && value instanceof Date;
	},
});

export function array<TItem extends Schema<unknown> = never>(
	item: TItem,
	validators: Validator[] = [],
): Schema<Array<Infer<TItem>>> & { readonly item: TItem } {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "array", item, validators } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof array>>("array", {
	// deno-lint-ignore ban-types
	validate(_schema, value): value is Array<{}> {
		return !!value && Array.isArray(value);
	},
	*walk(
		schema,
		value,
	): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
		if (!!value && Array.isArray(value)) {
			for (const [key, val] of value.entries()) {
				yield [`[${key}]`, val, schema.item];
			}
		}
	},
});

export function record<TItem extends Schema<unknown> = never>(
	item: TItem,
	validators: Validator[] = [],
): Schema<Record<string, Infer<TItem>>> & { readonly item: TItem } {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "record", item, validators } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof record>>("record", {
	// deno-lint-ignore ban-types
	validate(_schema, value): value is Record<string, {}> {
		return !!value && typeof value === "object";
	},
	*walk(
		schema,
		value,
	): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
		if (!!value && typeof value === "object") {
			for (const [key, val] of Object.entries(value)) {
				yield [`.${key}`, val, schema.item];
			}
		}
	},
});

export function object<
	TObject extends Record<string, Schema<unknown>> = never,
>(
	object: TObject,
	validators: Validator[] = [],
): Schema<{ [K in keyof TObject]: Infer<TObject[K]> }> & {
	readonly object: TObject;
} {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "object", object, validators } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof object>>("object", {
	// deno-lint-ignore ban-types
	validate(schema, value): value is { [x: string]: {} } {
		if (!value || typeof value !== "object") {
			return false;
		}
		const [requiredKeys, optionalKeys] = Object.entries(schema.object).reduce(
			(pair, [key, inner]) => {
				if (inner.kind === "optional") {
					pair[1].push(key);
				} else {
					pair[0].push(key);
				}
				return pair;
			},
			[[], []] as [required: string[], optional: string[]],
		);
		const keysValue = Object.keys(value);
		if (!requiredKeys.every((key) => keysValue.includes(key))) {
			return false;
		}
		const missingKeys = keysValue.filter((key) => !requiredKeys.includes(key));
		return missingKeys.every((key) => optionalKeys.includes(key));
	},
	*walk(
		schema,
		value,
	): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
		if (!!value && typeof value === "object") {
			for (const [key, inner] of Object.entries(schema.object)) {
				yield [`.${key}`, value[key as keyof typeof value], inner];
			}
		}
	},
});

export function optional<TItem extends Schema<unknown> = never>(
	item: TItem,
): Schema<Infer<TItem> | undefined> & { readonly item: TItem } {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "optional", item } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof optional>>("optional", {
	// deno-lint-ignore ban-types
	validate(_schema, _value): _value is {} {
		return true;
	},
	*walk(
		schema,
		value,
	): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
		if (value) {
			yield ["", value, schema.item];
		}
	},
});

export function literal<const TLiteral extends string | number | boolean>(
	literal: TLiteral,
): Schema<TLiteral> & { readonly literal: TLiteral } {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "literal", literal } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof literal>>("literal", {
	validate(schema, value): value is string | number | boolean {
		return schema.literal === value;
	},
});

export function choice<
	const TChoices extends readonly string[],
>(
	choices: TChoices,
): Schema<TChoices[number]> & { readonly choices: TChoices } {
	// Phantom type is only required at compile time
	// deno-lint-ignore no-explicit-any
	return { kind: "choice", choices } as any;
}
globalSchemaRegistry.registerSchema<ReturnType<typeof choice>>("choice", {
	validate(schema, value): value is string {
		return typeof value === "string" && schema.choices.includes(value);
	},
});
