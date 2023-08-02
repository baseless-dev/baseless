export type PhantomData<T> = {
	data: T;
};

// deno-lint-ignore ban-types
export type Schema<Kind, T, Props = {}> = {
	kind: Kind;
	validations?: Validator[];
	phantom?: PhantomData<T>;
} & Props;

export type SchemaImpl<TSchema extends Schema<string, unknown>> = {
	check: (
		schema: TSchema,
		value: unknown,
		registry: SchemaRegistry,
		context: Record<string, unknown>,
	) => boolean;
	walk?: (
		schema: TSchema,
		value: unknown,
		registry: SchemaRegistry,
		context: Record<string, unknown>,
	) => Generator<
		[
			key: string,
			value: unknown,
			schema: Schema<string, unknown>,
			context: Record<string, unknown>,
		]
	>;
};

// deno-lint-ignore ban-types
export type Validator<Props = {}> = {
	kind: string;
	msg?: string;
} & Props;

export type ValidatorImpl<TValidator extends Validator> = {
	validate: (
		validator: TValidator,
		value: unknown,
	) => boolean;
};

export class SchemaRegistry {
	public readonly schemas = new Map<
		string,
		SchemaImpl<Schema<string, unknown>>
	>();
	public readonly validators = new Map<string, ValidatorImpl<Validator>>();

	public registerSchema<TSchema extends Schema<string, unknown>>(
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

export type Infer<TSchema extends Schema<string, unknown>> = NonNullable<
	TSchema["phantom"]
>["data"];

export class SchemaKindAlreadyRegisteredError extends Error {
	name = "SchemaKindAlreadyRegisteredError" as const;
	constructor(public readonly kind: string) {
		super(`Schema kind already registred: ${kind}`);
	}
}

export class SchemaError extends Error {
	name = "SchemaError" as const;
	constructor(
		public readonly path: string[],
		public readonly causes: ReadonlyArray<SchemaError | ValidationError> = [],
	) {
		super(
			`Schema error${path.length > 0 ? ` at '${path.join(".")}'` : ""}${
				causes.length
					? ` (caused by ${
						causes.map((cause) => cause.message.replace(/[\s.]$/, "")).join(
							`; `,
						)
					})`
					: ""
			}.}`,
		);
	}
}

export class ValidationError extends Error {
	name = "ValidationError" as const;
	constructor(
		public readonly path: string[],
		msg?: string,
		public readonly causes: ReadonlyArray<ValidationError> = [],
	) {
		super(
			`Validation error${path.length > 0 ? ` at '${path.join(".")}'` : ""}${
				msg ? `, reason: ${msg}` : ""
			}${
				causes.length
					? ` (caused by ${
						causes.map((cause) => cause.message.replace(/[\s.]$/, "")).join(
							`; `,
						)
					})`
					: ""
			}.`,
		);
	}
}

export function assertSchema<TSchema extends Schema<string, unknown>>(
	schema: TSchema,
	value: unknown,
	path: string[] = [],
	context: Record<string, unknown> = {},
): asserts value is Infer<TSchema> {
	const schemaImpl = globalSchemaRegistry.schemas.get(schema.kind);
	if (!schemaImpl) {
		throw new SchemaError(path);
	}
	if (!schemaImpl.check(schema, value, globalSchemaRegistry, context)) {
		throw new SchemaError(path);
	}
	if (schema.validations) {
		const causes: Array<ValidationError> = [];
		for (const validator of schema.validations) {
			const validatorImpl = globalSchemaRegistry.validators.get(validator.kind);
			if (!validatorImpl) {
				throw new ValidationError(
					path,
					`Unknown validation "${validator.kind}".`,
				);
			}
			if (!validatorImpl.validate(validator, value)) {
				causes.push(new ValidationError(path, validator.msg));
			}
		}
		if (causes.length === 1) {
			throw causes[0];
		} else if (causes.length > 1) {
			throw new ValidationError(path, "", causes);
		}
	}
	if (schemaImpl.walk) {
		const causes: Array<SchemaError | ValidationError> = [];
		for (
			const [key, val, innerSchema, subContext] of schemaImpl.walk(
				schema,
				value,
				globalSchemaRegistry,
				context,
			)
		) {
			try {
				assertSchema(
					innerSchema,
					val,
					key ? [...path, key] : [...path],
					subContext,
				);
			} catch (error) {
				causes.push(error);
			}
		}
		if (causes.length === 1) {
			throw causes[0];
		} else if (causes.length > 1) {
			if (causes.every((cause) => cause instanceof ValidationError)) {
				throw new ValidationError(path, "", causes as ValidationError[]);
			} else {
				throw new SchemaError(path, causes);
			}
		}
	}
}

export function makeAssert<TSchema extends Schema<string, unknown>>(
	schema: TSchema,
): (value: unknown) => asserts value is Infer<TSchema> {
	return (value): asserts value is Infer<TSchema> =>
		assertSchema(schema, value);
}

export function isSchema<TSchema extends Schema<string, unknown>>(
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

export function makeGuard<TSchema extends Schema<string, unknown>>(
	schema: TSchema,
): (value: unknown) => value is Infer<TSchema> {
	return (value): value is Infer<TSchema> => isSchema(schema, value);
}
