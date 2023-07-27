import {
	globalSchemaRegistry,
	type Infer,
	type Schema,
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
globalSchemaRegistry.registerSchema<ReturnType<typeof nill>>("nill", {
	typeCheck(_schema, value): boolean {
		return value === null;
	},
});

export function undef(): Schema<undefined> {
	return { kind: "undef" };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof undef>>("undef", {
	typeCheck(_schema, value): boolean {
		return value === undefined;
	},
});

export function string(
	validations: Validator[] = [],
): Schema<string> {
	return { kind: "string", validations };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof string>>("string", {
	typeCheck(_schema, value): boolean {
		return typeof value === "string";
	},
});

export function number(
	validations: Validator[] = [],
): Schema<number> {
	return { kind: "number", validations };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof number>>("number", {
	typeCheck(_schema, value): boolean {
		return typeof value === "number";
	},
});

export function boolean(
	validations: Validator[] = [],
): Schema<boolean> {
	return { kind: "boolean", validations };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof boolean>>("boolean", {
	typeCheck(_schema, value): boolean {
		return typeof value === "boolean";
	},
});

export function date(
	validations: Validator[] = [],
): Schema<Date> {
	return { kind: "date", validations };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof date>>("date", {
	typeCheck(_schema, value): boolean {
		return !!value && value instanceof Date;
	},
});

export function array<TItem extends Schema<unknown> = never>(
	item: TItem,
	validations: Validator[] = [],
): Schema<Array<Infer<TItem>>, { item: TItem }> {
	return { kind: "array", item, validations };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof array>>("array", {
	typeCheck(_schema, value): boolean {
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
	validations: Validator[] = [],
): Schema<Record<string, Infer<TItem>>, { item: TItem }> {
	return { kind: "record", item, validations };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof record>>("record", {
	typeCheck(_schema, value): boolean {
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
	validations: Validator[] = [],
): Schema<{ [K in keyof TObject]: Infer<TObject[K]> }, {
	object: TObject;
}> {
	return { kind: "object", object, validations };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof object>>("object", {
	typeCheck(schema, value): boolean {
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
	schema: TItem,
): Schema<Infer<TItem> | undefined, { schema: TItem }> {
	return { kind: "optional", schema };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof optional>>("optional", {
	typeCheck(_schema, _value): boolean {
		return true;
	},
	*walk(
		schema,
		value,
	): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
		if (value) {
			yield ["", value, schema.schema];
		}
	},
});

export function literal<const TLiteral extends string | number | boolean>(
	literal: TLiteral,
): Schema<TLiteral, { literal: TLiteral }> {
	return { kind: "literal", literal };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof literal>>("literal", {
	typeCheck(schema, value): boolean {
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
globalSchemaRegistry.registerSchema<ReturnType<typeof choice>>("choice", {
	typeCheck(schema, value): boolean {
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
globalSchemaRegistry.registerSchema<ReturnType<typeof union>>("union", {
	typeCheck(schema, value, registry): boolean {
		throw "TODO";
	},
	*walk(
		schema,
		value,
	): Generator<[key: string, value: unknown, schema: Schema<unknown>]> {
		throw "TODO";
	},
});
