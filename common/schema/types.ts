export type Schema<T> = {
	readonly kind: string;
	readonly validators?: Validator[];
	readonly _phantom: T;
};

export type SchemaImpl<TSchema extends Schema<unknown>> = {
	readonly validate: (
		schema: TSchema,
		value: unknown,
	) => value is TSchema["_phantom"];
	readonly walk?: (
		schema: TSchema,
		value: unknown,
	) => Generator<[key: string, value: unknown, schema: Schema<unknown>]>;
};

export type Validator = {
	readonly kind: string;
	readonly msg?: string;
	readonly [key: string]: unknown;
};

export type ValidatorImpl<TValidator extends Validator> = {
	readonly validate: (
		validator: TValidator,
		value: unknown,
	) => boolean;
};

export class SchemaRegistry {
	public readonly schemas = new Map<string, SchemaImpl<Schema<unknown>>>();
	public readonly validators = new Map<string, ValidatorImpl<Validator>>();

	public registerSchema<TSchema extends Schema<unknown>>(
		kind: string,
		impl: SchemaImpl<TSchema>,
	): void {
		if (this.schemas.has(kind)) {
			throw new SchemaKindAlreadyRegisteredError(kind);
		}
		// deno-lint-ignore no-explicit-any
		this.schemas.set(kind, impl as any);
	}

	public registerValidator<TValidator extends Validator>(
		kind: string,
		impl: ValidatorImpl<TValidator>,
	): void {
		if (this.validators.has(kind)) {
			throw new SchemaKindAlreadyRegisteredError(kind);
		}
		// deno-lint-ignore no-explicit-any
		this.validators.set(kind, impl as any);
	}
}

export const globalSchemaRegistry = new SchemaRegistry();

export type Infer<TSchema extends Schema<unknown>> = TSchema["_phantom"];

export class SchemaAssertationError extends Error {
	constructor(
		public readonly path: string[],
		public readonly msg?: string,
		public readonly causes: SchemaAssertationError[] = [],
	) {
		super(
			`Schema assertation error${
				path.length > 0 ? ` at '${path.join("")}'` : ""
			}${msg ? `: ${msg}` : ""}${
				causes.length > 0
					? " caused by : " + causes.map((cause) => cause.message).join(`\n`)
					: ""
			}`,
		);
	}
}

export class SchemaKindAlreadyRegisteredError extends Error {
	constructor(public readonly kind: string) {
		super(`Schema kind already registred: ${kind}`);
	}
}

export class UnknownSchemaKindError extends Error {
	constructor(public readonly kind: string) {
		super(`Unknown schema kind: ${kind}`);
	}
}

export function assertSchema<TSchema extends Schema<unknown>>(
	schema: TSchema,
	value: unknown,
	path: string[] = [],
): asserts value is Infer<TSchema> {
	const schemaImpl = globalSchemaRegistry.schemas.get(schema.kind);
	if (!schemaImpl) {
		throw new UnknownSchemaKindError(schema.kind);
	}
	if (!schemaImpl.validate(schema, value)) {
		throw new SchemaAssertationError(path, "");
	}
	const causes: SchemaAssertationError[] = [];
	if (schema.validators) {
		for (const validator of schema.validators) {
			const validatorImpl = globalSchemaRegistry.validators.get(validator.kind);
			if (!validatorImpl) {
				throw new UnknownSchemaKindError(validator.kind);
			}
			if (!validatorImpl.validate(validator, value)) {
				causes.push(new SchemaAssertationError(path, validator.msg));
			}
		}
	}
	if (schemaImpl.walk) {
		for (const [key, val, inner] of schemaImpl.walk(schema, value)) {
			try {
				assertSchema(inner, val, [...path, key]);
			} catch (error) {
				causes.push(error);
			}
		}
	}
	if (causes.length > 0) {
		throw new SchemaAssertationError(path, "", causes);
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
