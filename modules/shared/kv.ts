/**
 * Type alias for string | ReadableStream | ArrayBuffer
 */
export type KVData = null | string | ReadableStream | ArrayBuffer;

/**
 * KVValue object
 */
export interface IKVValue<Metadata> {
	/**
	 * Key of the value
	 */
	key: string;

	/**
	 * Metadata of the value
	 */
	metadata: Metadata;

	/**
	 * Retrieve the underlying value's data
	 */
	data(): Promise<KVData>;
}

/**
 * Document not found error
 */
export class KeyNotFoundError extends Error {
	public name = "KeyNotFoundError";
	public constructor(key: string) {
		super(`Key not found at '${key}'.`);
	}
}
