// deno-lint-ignore-file explicit-function-return-type
export type Validator = {
	readonly kind: string;
	validate(value: unknown): boolean;
};

export type EqualValidator = Validator & {
	readonly kind: "equal";
	readonly value: string | number | boolean | Date;
};
export type NotEqualValidator = Validator & {
	readonly kind: "notEqual";
	readonly value: string | number | boolean | Date;
};
export type MatchValidator = Validator & {
	readonly kind: "match";
	readonly regex: RegExp;
};
export type GreaterThanValidator = Validator & {
	readonly kind: "greaterThan";
	readonly value: string | number | Date;
};
export type GreaterThanOrEqualValidator = Validator & {
	readonly kind: "greaterThanOrEqual";
	readonly value: string | number | Date;
};
export type LesserThanValidator = Validator & {
	readonly kind: "lesserThan";
	readonly value: string | number | Date;
};
export type LesserThanOrEqualValidator = Validator & {
	readonly kind: "lesserThanOrEqual";
	readonly value: string | number | Date;
};
export type MinLengthValidator = Validator & {
	readonly kind: "minLength";
	readonly length: number;
};
export type MaxLengthValidator = Validator & {
	readonly kind: "maxLength";
	readonly length: number;
};
export type MinSizeValidator = Validator & {
	readonly kind: "minSize";
	readonly size: number;
};
export type MaxSizeValidator = Validator & {
	readonly kind: "maxSize";
	readonly size: number;
};

export function eq(
	value: string | number | Date,
): EqualValidator {
	return {
		kind: "equal",
		value,
		validate(value) {
			return (typeof value === "string" || typeof value === "number" ||
				typeof value === "boolean" || value instanceof Date) &&
				value === this.value;
		},
	};
}
export function neq(
	value: string | number | Date,
): NotEqualValidator {
	return {
		kind: "notEqual",
		value,
		validate(value) {
			return (typeof value === "string" || typeof value === "number" ||
				typeof value === "boolean" || value instanceof Date) &&
				value !== this.value;
		},
	};
}
export function match(
	regex: RegExp,
): MatchValidator {
	return {
		kind: "match",
		regex,
		validate(value) {
			return typeof value === "string" && this.regex.test(value);
		},
	};
}
export function gt(
	value: string | number | Date,
): GreaterThanValidator {
	return {
		kind: "greaterThan",
		value,
		validate(value) {
			return (typeof value === "string" || typeof value === "number" ||
				value instanceof Date) && value > this.value;
		},
	};
}
export function gte(
	value: string | number | Date,
): GreaterThanOrEqualValidator {
	return {
		kind: "greaterThanOrEqual",
		value,
		validate(value) {
			return (typeof value === "string" || typeof value === "number" ||
				value instanceof Date) && value >= this.value;
		},
	};
}
export function lt(
	value: string | number | Date,
): LesserThanValidator {
	return {
		kind: "lesserThan",
		value,
		validate(value) {
			return (typeof value === "string" || typeof value === "number" ||
				value instanceof Date) && value < this.value;
		},
	};
}
export function lte(
	value: string | number | Date,
): LesserThanOrEqualValidator {
	return {
		kind: "lesserThanOrEqual",
		value,
		validate(value) {
			return (typeof value === "string" || typeof value === "number" ||
				value instanceof Date) && value <= this.value;
		},
	};
}
export function minLength(
	length: number,
): MinLengthValidator {
	return {
		kind: "minLength",
		length,
		validate(value) {
			return typeof value === "string" && value.length >= this.length;
		},
	};
}
export function maxLength(
	length: number,
): MaxLengthValidator {
	return {
		kind: "maxLength",
		length,
		validate(value) {
			return typeof value === "string" && value.length <= this.length;
		},
	};
}
export function minSize(
	size: number,
): MinSizeValidator {
	return {
		kind: "minSize",
		size,
		validate(value) {
			return (Array.isArray(value) && value.length >= this.size) ||
				(value instanceof Map && value.size >= this.size) ||
				(value instanceof Set && value.size >= this.size) ||
				(!!value && typeof value === "object" &&
					Object.keys(value).length >= this.size);
		},
	};
}
export function maxSize(
	size: number,
): MaxSizeValidator {
	return {
		kind: "maxSize",
		size,
		validate(value) {
			return (Array.isArray(value) && value.length <= this.size) ||
				(value instanceof Map && value.size <= this.size) ||
				(value instanceof Set && value.size <= this.size) ||
				(!!value && typeof value === "object" &&
					Object.keys(value).length <= this.size);
		},
	};
}
