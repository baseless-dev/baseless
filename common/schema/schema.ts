import { type AutoId, isAutoId } from "../system/autoid.ts";
import {
	type Infer,
	registry,
	type Schema,
	type SchemaImplValidationGenerator,
	type Validator,
} from "./types.ts";

export function lazy<TSchema extends Schema<unknown>>(
	initializer: () => TSchema,
): TSchema {
	let cached: TSchema | undefined = undefined;
	return new Proxy({}, {
		// deno-lint-ignore no-explicit-any
		get(_target, prop): any {
			if (!cached) {
				cached = initializer();
			}
			return cached[prop as keyof TSchema];
		},
		has(_target, prop): boolean {
			if (!cached) {
				cached = initializer();
			}
			return prop in cached;
		},
		// deno-lint-ignore no-explicit-any
	}) as any as TSchema;
}

export function nill(): Schema<null> {
	return { kind: "nill" };
}
registry.registerSchema<ReturnType<typeof nill>>("nill", {
	// deno-lint-ignore require-yield
	*validate(_schema, value): SchemaImplValidationGenerator {
		return value === null;
	},
});

export function undef(): Schema<undefined> {
	return { kind: "undef" };
}
registry.registerSchema<ReturnType<typeof undef>>("undef", {
	// deno-lint-ignore require-yield
	*validate(_schema, value): SchemaImplValidationGenerator {
		return value === undefined;
	},
});

export function unknown(): Schema<unknown> {
	return { kind: "unknown" };
}
registry.registerSchema<ReturnType<typeof unknown>>("unknown", {
	// deno-lint-ignore require-yield
	*validate(_schema, _value): SchemaImplValidationGenerator {
		return true;
	},
});

export function string(validations: Validator[] = []): Schema<string> {
	return { kind: "string", ...(validations?.length ? { validations } : {}) };
}
registry.registerSchema<ReturnType<typeof string>>("string", {
	// deno-lint-ignore require-yield
	*validate(_schema, value): SchemaImplValidationGenerator {
		return typeof value === "string";
	},
});

export function autoid(prefix = ""): Schema<AutoId, { prefix?: string }> {
	return { kind: "autoid", ...(prefix ? { prefix } : {}) };
}
registry.registerSchema<ReturnType<typeof autoid>>("autoid", {
	// deno-lint-ignore require-yield
	*validate(schema, value): SchemaImplValidationGenerator {
		return typeof value === "string" && isAutoId(value, schema.prefix);
	},
});

export function number(validations: Validator[] = []): Schema<number> {
	return { kind: "number", ...(validations?.length ? { validations } : {}) };
}
registry.registerSchema<ReturnType<typeof number>>("number", {
	// deno-lint-ignore require-yield
	*validate(_schema, value): SchemaImplValidationGenerator {
		return typeof value === "number";
	},
});

export function boolean(validations: Validator[] = []): Schema<boolean> {
	return { kind: "boolean", ...(validations?.length ? { validations } : {}) };
}
registry.registerSchema<ReturnType<typeof boolean>>("boolean", {
	// deno-lint-ignore require-yield
	*validate(_schema, value): SchemaImplValidationGenerator {
		return typeof value === "boolean";
	},
});

export function func<const Args extends unknown[], Return>(): Schema<
	(...args: Args) => Return
> {
	return { kind: "function" };
}
registry.registerSchema<ReturnType<typeof func>>("function", {
	// deno-lint-ignore require-yield
	*validate(_schema, value): SchemaImplValidationGenerator {
		return typeof value === "function";
	},
});

export function date(validations: Validator[] = []): Schema<Date> {
	return { kind: "date", ...(validations?.length ? { validations } : {}) };
}
registry.registerSchema<ReturnType<typeof date>>("date", {
	// deno-lint-ignore require-yield
	*validate(_schema, value): SchemaImplValidationGenerator {
		return !!value && value instanceof Date;
	},
});

export function array<TItem extends Schema<unknown> = never>(
	item: TItem,
	validations: Validator[] = [],
): Schema<Array<Infer<TItem>>, { item: TItem }> {
	return {
		kind: "array",
		item,
		...(validations?.length ? { validations } : {}),
	};
}
registry.registerSchema<ReturnType<typeof array>>("array", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		if (!value || !Array.isArray(value)) {
			return false;
		}
		for (const [key, val] of value.entries()) {
			yield [key.toString(), val, schema.item, context];
		}
		return true;
	},
});

export function record<TItem extends Schema<unknown> = never>(
	item: TItem,
	validations: Validator[] = [],
): Schema<Record<string, Infer<TItem>>, { item: TItem }> {
	return {
		kind: "record",
		item,
		...(validations?.length ? { validations } : {}),
	};
}
registry.registerSchema<ReturnType<typeof record>>("record", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		if (!value || typeof value !== "object") {
			return false;
		}
		for (const [key, val] of Object.entries(value)) {
			yield [key, val, schema.item, context];
		}
		return true;
	},
});

export function object<
	TObject extends Record<string, Schema<unknown>>,
	TRequired extends Omit<TObject, TOptional[number]>,
	TOutput extends
		& { [K in keyof TRequired]: Infer<TRequired[K]> }
		& { [K in TOptional[number]]?: Infer<TObject[K]> },
	const TOptional extends readonly (keyof TObject)[] = [],
>(
	object: TObject,
	// deno-lint-ignore no-explicit-any
	optional: TOptional = [] as any,
	validations: Validator[] = [],
): Schema<
	{ [K in keyof TOutput]: TOutput[K] },
	{
		object: TObject;
		optional?: string[];
	}
> {
	return {
		kind: "object",
		object,
		...(validations?.length ? { validations } : {}),
		// deno-lint-ignore no-explicit-any
		...(optional?.length ? { optional: optional as any } : {}),
	};
}
registry.registerSchema<ReturnType<typeof object>>("object", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		if (!value || typeof value !== "object") {
			return false;
		}
		const keys = new Set(Object.keys(value));
		for (const [key, inner] of Object.entries(schema.object)) {
			const isOptional = context.partial === true ||
				(schema.optional?.includes(key as keyof typeof schema.object) ?? false);
			const innerSchema = isOptional ? optional(inner) : inner;
			yield [key, value[key as keyof typeof value], innerSchema, context];
			keys.delete(key);
		}
		return keys.size === 0;
	},
});

export function optional<TItem extends Schema<unknown> = never>(
	schema: TItem,
): Schema<Infer<TItem> | undefined, { schema: TItem }> {
	return { kind: "optional", schema };
}
registry.registerSchema<ReturnType<typeof optional>>("optional", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		if (value) {
			yield ["", value, schema.schema, context];
		}
		return true;
	},
});

export function partial<
	TSchema extends Schema<unknown> = never,
>(
	schema: TSchema,
): Schema<Partial<Infer<TSchema>>, { schema: TSchema }> {
	return { kind: "partial", schema };
}
registry.registerSchema<ReturnType<typeof partial>>("partial", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		yield ["", value, schema.schema, {
			...context,
			partial: true,
		}];
		return true;
	},
});

export function literal<const TLiteral extends string | number | boolean>(
	literal: TLiteral,
): Schema<TLiteral, { literal: TLiteral }> {
	return { kind: "literal", literal };
}
registry.registerSchema<ReturnType<typeof literal>>("literal", {
	// deno-lint-ignore require-yield
	*validate(schema, value): SchemaImplValidationGenerator {
		return schema.literal === value;
	},
});

export function choice<
	const TChoices extends readonly string[],
>(
	choices: TChoices,
): Schema<TChoices[number], { choices: TChoices }> {
	return { kind: "choice", choices };
}
registry.registerSchema<ReturnType<typeof choice>>("choice", {
	// deno-lint-ignore require-yield
	*validate(schema, value): SchemaImplValidationGenerator {
		return typeof value === "string" && schema.choices.includes(value);
	},
});

export function union<
	const TSchemas extends readonly Schema<unknown>[],
>(
	schemas: TSchemas,
): Schema<Infer<TSchemas[number]>, { schemas: TSchemas }> {
	return { kind: "union", schemas };
}
registry.registerSchema<ReturnType<typeof union>>("union", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		for (const inner of schema.schemas) {
			try {
				yield ["", value, inner, context];
				return true;
			} catch (_error) {
				// empty
			}
		}
		return false;
	},
});

export function tuple<
	const TSchemas extends readonly Schema<unknown>[],
>(
	tuples: TSchemas,
): Schema<
	{ [K in keyof TSchemas]: Infer<TSchemas[K]> },
	{ tuples: TSchemas }
> {
	return { kind: "tuple", tuples };
}
registry.registerSchema<ReturnType<typeof tuple>>("tuple", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		if (
			!value || !Array.isArray(value) || value.length !== schema.tuples.length
		) {
			return false;
		}
		for (const [key, inner] of schema.tuples.entries()) {
			yield [`[${key}]`, value[key as keyof typeof value], inner, context];
		}
		return true;
	},
});

export function describe<TItem extends Schema<unknown> = never>(
	{ label, description }: {
		description?: string;
		label?: string;
	},
	schema: TItem,
): Schema<
	Infer<TItem>,
	{ schema: TItem; description?: string; label?: string }
> {
	return {
		kind: "describe",
		...(description ? { description } : {}),
		...(label ? { label } : {}),
		schema,
	};
}
registry.registerSchema<ReturnType<typeof describe>>("describe", {
	*validate(schema, value, context): SchemaImplValidationGenerator {
		yield ["", value, schema.schema, context];
		return true;
	},
});
