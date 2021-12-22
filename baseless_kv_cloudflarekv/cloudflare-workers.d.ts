/**
 * Stole directly from https://github.com/cloudflare/workers-types
 */

/**
 * Workers KV is a global, low-latency, key-value data store. It supports exceptionally high read volumes with low-latency,
 * making it possible to build highly dynamic APIs and websites which respond as quickly as a cached static file would.
 */
interface KVNamespace {
	get(
		key: string,
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<string | null>;
	get(key: string, type: "text"): Promise<string | null>;
	get<ExpectedValue = unknown>(
		key: string,
		type: "json",
	): Promise<ExpectedValue | null>;
	get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
	get(key: string, type: "stream"): Promise<ReadableStream | null>;
	get(
		key: string,
		options: KVNamespaceGetOptions<"text">,
	): Promise<string | null>;
	get<ExpectedValue = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"json">,
	): Promise<ExpectedValue | null>;
	get(
		key: string,
		options: KVNamespaceGetOptions<"arrayBuffer">,
	): Promise<ArrayBuffer | null>;
	get(
		key: string,
		options: KVNamespaceGetOptions<"stream">,
	): Promise<ReadableStream | null>;
	list<Metadata = unknown>(
		options?: KVNamespaceListOptions,
	): Promise<KVNamespaceListResult<Metadata>>;
	/**
	 * Creates a new key-value pair, or updates the value for a particular key.
	 * @param key key to associate with the value. A key cannot be empty, `.` or `..`. All other keys are valid.
	 * @param value value to store. The type is inferred. The maximum size of a value is 25MB.
	 * @returns Returns a `Promise` that you should `await` on in order to verify a successful update.
	 * @example
	 * await NAMESPACE.put(key, value)
	 */
	put(
		key: string,
		value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
		options?: KVNamespacePutOptions,
	): Promise<void>;
	getWithMetadata<Metadata = unknown>(
		key: string,
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
	getWithMetadata<Metadata = unknown>(
		key: string,
		type: "text",
	): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
	getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
		key: string,
		type: "json",
	): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>;
	getWithMetadata<Metadata = unknown>(
		key: string,
		type: "arrayBuffer",
	): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>;
	getWithMetadata<Metadata = unknown>(
		key: string,
		type: "stream",
	): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>;
	getWithMetadata<Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"text">,
	): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
	getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"json">,
	): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>;
	getWithMetadata<Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"arrayBuffer">,
	): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>;
	getWithMetadata<Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"stream">,
	): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>;
	delete(name: string): Promise<void>;
}

interface KVNamespaceGetOptions<Type> {
	type: Type;
	cacheTtl?: number;
}

interface KVNamespaceGetWithMetadataResult<Value, Metadata> {
	value: Value | null;
	metadata: Metadata | null;
}

interface KVNamespaceListKey<Metadata> {
	name: string;
	expiration?: number;
	metadata?: Metadata;
}

interface KVNamespaceListOptions {
	limit?: number;
	prefix?: string | null;
	cursor?: string | null;
}

interface KVNamespaceListResult<Metadata> {
	keys: KVNamespaceListKey<Metadata>[];
	list_complete: boolean;
	cursor?: string;
}

interface KVNamespacePutOptions {
	expiration?: number;
	expirationTtl?: number;
	metadata?: any | null;
}
