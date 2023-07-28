import { globalSchemaRegistry, type Validator } from "./types.ts";

export function eq(
	v: string | number | Date,
	msg?: string,
): Validator<{ v: string | number | Date }> {
	return { kind: "eq", v, msg };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof eq>>("eq", {
	validate(validator, value): boolean {
		return validator.v == value;
	},
});

export function neq(
	value: string | number | Date,
	msg?: string,
): Validator<{ value: string | number | Date }> {
	return { kind: "neq", value, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof neq>>("neq", {
	validate(validator, value): boolean {
		return validator.value != value;
	},
});

export function match(
	regexp: RegExp,
	msg?: string,
): Validator<{ regexp: RegExp }> {
	return {
		kind: "match",
		regexp,
		...(msg ? { msg } : {}),
	};
}
globalSchemaRegistry.registerValidator<ReturnType<typeof match>>("match", {
	validate(validator, value): boolean {
		return typeof value === "string" && validator.regexp.test(value);
	},
});

export function gt(
	value: string | number | Date,
	msg?: string,
): Validator<{ value: string | number | Date }> {
	return { kind: "gt", value, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof gt>>("gt", {
	validate(validator, value): boolean {
		return (typeof value === "string" || typeof value === "number" ||
			value instanceof Date) && value > validator.value;
	},
});

export function gte(
	value: string | number | Date,
	msg?: string,
): Validator<{ value: string | number | Date }> {
	return { kind: "gte", value, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof gte>>("gte", {
	validate(validator, value): boolean {
		return (typeof value === "string" || typeof value === "number" ||
			value instanceof Date) && value >= validator.value;
	},
});

export function lt(
	value: string | number | Date,
	msg?: string,
): Validator<{ value: string | number | Date }> {
	return { kind: "lt", value, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof lt>>("lt", {
	validate(validator, value): boolean {
		return (typeof value === "string" || typeof value === "number" ||
			value instanceof Date) && value < validator.value;
	},
});

export function lte(
	value: string | number | Date,
	msg?: string,
): Validator<{ value: string | number | Date }> {
	return { kind: "lte", value, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof lte>>("lte", {
	validate(validator, value): boolean {
		return (typeof value === "string" || typeof value === "number" ||
			value instanceof Date) && value <= validator.value;
	},
});

export function minLength(
	length: number,
	msg?: string,
): Validator<{ length: number }> {
	return { kind: "minLength", length, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof minLength>>(
	"minLength",
	{
		validate(validator, value): boolean {
			return typeof value === "string" && value.length >= validator.length;
		},
	},
);

export function maxLength(
	length: number,
	msg?: string,
): Validator<{ length: number }> {
	return { kind: "maxLength", length, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof maxLength>>(
	"maxLength",
	{
		validate(validator, value): boolean {
			return typeof value === "string" && value.length <= validator.length;
		},
	},
);

export function minSize(
	size: number,
	msg?: string,
): Validator<{ size: number }> {
	return { kind: "minSize", size, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof minSize>>("minSize", {
	validate(validator, value): boolean {
		return (Array.isArray(value) && value.length >= validator.size) ||
			(value instanceof Map && value.size >= validator.size) ||
			(value instanceof Set && value.size >= validator.size) ||
			(!!value && typeof value === "object" &&
				Object.keys(value).length >= validator.size);
	},
});

export function maxSize(
	size: number,
	msg?: string,
): Validator<{ size: number }> {
	return { kind: "maxSize", size, ...(msg ? { msg } : {}) };
}
globalSchemaRegistry.registerValidator<ReturnType<typeof maxSize>>("maxSize", {
	validate(validator, value): boolean {
		return (Array.isArray(value) && value.length <= validator.size) ||
			(value instanceof Map && value.size <= validator.size) ||
			(value instanceof Set && value.size <= validator.size) ||
			(!!value && typeof value === "object" &&
				Object.keys(value).length <= validator.size);
	},
});
