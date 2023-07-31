import { isAutoId } from "../system/autoid.ts";
import {
	globalSchemaRegistry,
	type Infer,
	type Schema,
	type Validator,
} from "./types.ts";

export function lazy<TSchema extends Schema<string, unknown>>(
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

export function nill(): Schema<"nill", null> {
	return { kind: "nill" };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof nill>>("nill", {
	check(_schema, value): boolean {
		return value === null;
	},
});

export function undef(): Schema<"undef", undefined> {
	return { kind: "undef" };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof undef>>("undef", {
	check(_schema, value): boolean {
		return value === undefined;
	},
});

export function unknown(): Schema<"unknown", unknown> {
	return { kind: "unknown" };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof unknown>>("unknown", {
	check(): boolean {
		return true;
	},
});

export function string(
	validations: Validator[] = [],
): Schema<"string", string> {
	return { kind: "string", ...(validations?.length ? { validations } : {}) };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof string>>("string", {
	check(_schema, value): boolean {
		return typeof value === "string";
	},
});

export function autoid(
	prefix = "",
): Schema<"autoid", string, { prefix?: string }> {
	return { kind: "autoid", ...(prefix ? { prefix } : {}) };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof autoid>>("autoid", {
	check(schema, value): boolean {
		return isAutoId(value, schema.prefix);
	},
});

export function number(
	validations: Validator[] = [],
): Schema<"number", number> {
	return { kind: "number", ...(validations?.length ? { validations } : {}) };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof number>>("number", {
	check(_schema, value): boolean {
		return typeof value === "number";
	},
});

export function boolean(
	validations: Validator[] = [],
): Schema<"boolean", boolean> {
	return { kind: "boolean", ...(validations?.length ? { validations } : {}) };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof boolean>>("boolean", {
	check(_schema, value): boolean {
		return typeof value === "boolean";
	},
});

export function date(
	validations: Validator[] = [],
): Schema<"date", Date> {
	return { kind: "date", ...(validations?.length ? { validations } : {}) };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof date>>("date", {
	check(_schema, value): boolean {
		return !!value && value instanceof Date;
	},
});

export function array<TItem extends Schema<string, unknown> = never>(
	item: TItem,
	validations: Validator[] = [],
): Schema<"array", Array<Infer<TItem>>, { item: TItem }> {
	return {
		kind: "array",
		item,
		...(validations?.length ? { validations } : {}),
	};
}
globalSchemaRegistry.registerSchema<ReturnType<typeof array>>("array", {
	check(_schema, value): boolean {
		return !!value && Array.isArray(value);
	},
	*walk(
		schema,
		value,
		_registry,
		context,
	): Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	> {
		if (!!value && Array.isArray(value)) {
			for (const [key, val] of value.entries()) {
				yield [key.toString(), val, schema.item, context];
			}
		}
	},
});

export function record<TItem extends Schema<string, unknown> = never>(
	item: TItem,
	validations: Validator[] = [],
): Schema<"record", Record<string, Infer<TItem>>, { item: TItem }> {
	return {
		kind: "record",
		item,
		...(validations?.length ? { validations } : {}),
	};
}
globalSchemaRegistry.registerSchema<ReturnType<typeof record>>("record", {
	check(_schema, value): boolean {
		return !!value && typeof value === "object";
	},
	*walk(
		schema,
		value,
		_registry,
		context,
	): Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	> {
		if (!!value && typeof value === "object") {
			for (const [key, val] of Object.entries(value)) {
				yield [key, val, schema.item, context];
			}
		}
	},
});

export function object<
	TObject extends Record<string, Schema<string, unknown>> = never,
>(
	object: TObject,
	validations: Validator[] = [],
): Schema<"object", { [K in keyof TObject]: Infer<TObject[K]> }, {
	object: TObject;
}> {
	return {
		kind: "object",
		object,
		...(validations?.length ? { validations } : {}),
	};
}
globalSchemaRegistry.registerSchema<ReturnType<typeof object>>("object", {
	check(schema, value, _registry, context): boolean {
		if (!value || typeof value !== "object") {
			return false;
		}
		const forceOptional = context.partial === true;
		const [requiredKeys, optionalKeys] = Object.entries(schema.object).reduce(
			(pair, [key, inner]) => {
				if (forceOptional || inner.kind === "optional") {
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
		_registry,
		context,
	): Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	> {
		const { partial, ...innerContext } = context;
		if (!!value && typeof value === "object") {
			for (const [key, inner] of Object.entries(schema.object)) {
				yield [
					key,
					value[key as keyof typeof value],
					partial === true ? optional(inner) : inner,
					innerContext,
				];
			}
		}
	},
});

export function optional<TItem extends Schema<string, unknown> = never>(
	schema: TItem,
): Schema<"optional", Infer<TItem> | undefined, { schema: TItem }> {
	return { kind: "optional", schema };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof optional>>("optional", {
	check(_schema, _value): boolean {
		return true;
	},
	*walk(
		schema,
		value,
		_registry,
		context,
	): Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	> {
		if (value) {
			yield ["", value, schema.schema, context];
		}
	},
});

export function partial<
	TSchema extends Schema<string, unknown> = never,
>(
	schema: TSchema,
): Schema<"partial", Partial<Infer<TSchema>>, { schema: TSchema }> {
	return { kind: "partial", schema };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof partial>>("partial", {
	check(schema, value): boolean {
		if (schema.schema.kind !== "object") {
			return true;
		}
		return !!value && typeof value === "object";
	},
	*walk(
		schema,
		value,
		_registry,
		context,
	): Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	> {
		yield ["", value, schema.schema, { ...context, partial: true }];
	},
});

export function literal<const TLiteral extends string | number | boolean>(
	literal: TLiteral,
): Schema<"literal", TLiteral, { literal: TLiteral }> {
	return { kind: "literal", literal };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof literal>>("literal", {
	check(schema, value): boolean {
		return schema.literal === value;
	},
});

export function choice<
	const TChoices extends readonly string[],
>(
	choices: TChoices,
): Schema<"choice", TChoices[number], { choices: TChoices }> {
	return { kind: "choice", choices };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof choice>>("choice", {
	check(schema, value): boolean {
		return typeof value === "string" && schema.choices.includes(value);
	},
});

export function union<
	const TSchemas extends readonly Schema<string, unknown>[],
>(
	schemas: TSchemas,
): Schema<"union", Infer<TSchemas[number]>, { schemas: TSchemas }> {
	return { kind: "union", schemas };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof union>>("union", {
	check(schema, value, registry, context): boolean {
		return schema.schemas.some((inner) => {
			const schemaImpl = globalSchemaRegistry.schemas.get(inner.kind);
			if (!schemaImpl) {
				return false;
			}
			return schemaImpl.check(inner, value, registry, context);
		});
	},
	*walk(
		schema,
		value,
		registry,
		context,
	): Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	> {
		const inner = schema.schemas.find((inner) => {
			const schemaImpl = globalSchemaRegistry.schemas.get(inner.kind);
			if (!schemaImpl) {
				return false;
			}
			return schemaImpl.check(inner, value, registry, context);
		});
		yield ["", value, inner as Schema<string, unknown>, context];
	},
});

export function tuple<
	const TSchemas extends readonly Schema<string, unknown>[],
>(
	tuples: TSchemas,
): Schema<
	"tuple",
	{ [K in keyof TSchemas]: Infer<TSchemas[K]> },
	{ tuples: TSchemas }
> {
	return { kind: "tuple", tuples };
}
globalSchemaRegistry.registerSchema<ReturnType<typeof tuple>>("tuple", {
	check(schema, value): boolean {
		return !!value && Array.isArray(value) &&
			value.length === schema.tuples.length;
	},
	*walk(
		schema,
		value,
		_registry,
		context,
	): Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	> {
		if (
			!!value && Array.isArray(value) && value.length === schema.tuples.length
		) {
			for (const [key, inner] of schema.tuples.entries()) {
				yield [`[${key}]`, value[key as keyof typeof value], inner, context];
			}
		}
	},
});
