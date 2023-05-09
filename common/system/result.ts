abstract class IResult<Value, Error> {
	abstract readonly isOk: boolean;
	abstract readonly isError: boolean;
	abstract unwrap(): Value;
	expect(error?: string | globalThis.Error): void {
		try {
			this.unwrap();
		} catch (inner) {
			throw error ?? inner;
		}
	}
	abstract and(res: Result<Value, Error>): Result<Value, Error>;
	abstract andThen(op: () => Result<Value, Error>): Result<Value, Error>;
	abstract or(res: Result<Value, Error>): Result<Value, Error>;
	abstract orThen(op: () => Result<Value, Error>): Result<Value, Error>;
	abstract map<NewValue>(op: (value: Value) => Result<NewValue, Error>): Result<NewValue, Error>;
	abstract mapErr<NewError>(op: (error: Error) => Result<Value, NewError>): Result<Value, NewError>;
}

export class Ok<Value> extends IResult<Value, never> {
	get isOk() {
		return true as const;
	}
	get isError() {
		return false as const;
	}
	#value: Value;
	constructor(value: Value) {
		super();
		this.#value = value;
	}
	get value() {
		return this.#value;
	}
	unwrap() {
		return this.#value;
	}
	and<Error>(res: Result<Value, Error>): Result<Value, Error> {
		return res;
	}
	andThen<Error>(op: () => Result<Value, Error>): Result<Value, Error> {
		return this.and(op());
	}
	or<Error>(_res: Result<Value, Error>): Result<Value, Error> {
		return this;
	}
	orThen<Error>(op: () => Result<Value, Error>): Result<Value, Error> {
		return this.or(op());
	}
	map<NewValue>(op: (value: Value) => Result<NewValue, never>): Result<NewValue, never> {
		return op(this.value);
	}
	mapErr(): Result<Value, never> {
		return this;
	}
}

export class Err<Error> extends IResult<never, Error> {
	get isOk() {
		return false as const;
	}
	get isError() {
		return true as const;
	}
	#error: Error;
	constructor(error: Error) {
		super();
		this.#error = error;
	}
	get error() {
		return this.#error;
	}
	unwrap(): never {
		throw this.#error;
	}
	and<Value>(_res: Result<Value, Error>): Result<Value, Error> {
		return this;
	}
	andThen<Value>(op: () => Result<Value, Error>): Result<Value, Error> {
		return this.and(op());
	}
	or<Value>(res: Result<Value, Error>): Result<Value, Error> {
		return res;
	}
	orThen<Value>(op: () => Result<Value, Error>): Result<Value, Error> {
		return this.or(op());
	}
	map(): Result<never, Error> {
		return this;
	}
	mapErr<NewError>(op: (error: Error) => Result<never, NewError>): Result<never, NewError> {
		return op(this.error);
	}
}

export type Result<Value, Error> = Ok<Value> | Err<Error>;
export function ok(): Ok<void>;
export function ok<Value>(value: Value): Ok<Value>;
export function ok<Value>(value?: Value): Ok<Value> {
	return new Ok(value as Value);
}
export function err(): Err<void>;
export function err<Error>(error: Error): Err<Error>;
export function err<Error>(error?: Error): Err<Error> {
	return new Err(error as Error);
}
