export type Schema<T> = {
	readonly kind: string;
	readonly msg?: string;
	readonly validate: (value: unknown) => value is T;
	readonly children?: (
		value: unknown,
	) => Generator<[key: string, value: unknown, schema: Schema<unknown>]>;
	readonly _phantom?: T;
	readonly [key: string]: unknown;
};

export type Validator = {
	readonly kind: string;
	readonly validate: (value: unknown) => boolean;
	readonly [key: string]: unknown;
};

export type Infer<TSchema extends Schema<unknown>> = TSchema["_phantom"];

export class SchemaAssertationError extends Error {
	constructor(
		public readonly path: string[],
		public readonly msg?: string,
		public readonly causes: SchemaAssertationError[] = [],
	) {
		super(
			`Schema assertation error${
				path.length > 0 ? ` at ${path.join("")}` : ""
			}: ${msg}`,
		);
	}
}

export function assertSchema<TSchema extends Schema<unknown>>(
	schema: TSchema,
	value: unknown,
	path: string[] = [],
): asserts value is Infer<TSchema> {
	if (!schema.validate(value)) {
		throw new SchemaAssertationError(path, schema.msg);
	}
	if (schema.children) {
		const causes: SchemaAssertationError[] = [];
		for (const [key, val, inner] of schema.children(value)) {
			try {
				assertSchema(inner, val, [...path, key]);
			} catch (error) {
				causes.push(error);
			}
		}
		if (causes.length > 0) {
			throw new SchemaAssertationError(path, schema.msg, causes);
		}
	}
}

export function isSchema<TSchema extends Schema<unknown>>(
	schema: TSchema,
	value: unknown,
): value is Infer<TSchema> {
	try {
		assertSchema(schema, value);
		return true;
	} catch (_error) {
		return false;
	}
}
