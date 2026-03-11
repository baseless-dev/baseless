import {
	type StorageDownloadOptions,
	type StorageListEntry,
	type StorageListOptions,
	type StorageObject,
	StorageObjectNotFoundError,
	StorageProvider,
	type StorageSignedUrl,
	type StorageUploadOptions,
} from "@baseless/server";
import OrderedMap from "./ordered_map.ts";

/**
 * In-memory implementation of {@link StorageProvider}.
 *
 * Stores file metadata in an {@link OrderedMap} keyed by their path.
 * Generates `data:` signed URLs for testing.  Suitable for unit tests
 * and local development; data is not persisted.
 */
export class MemoryStorageProvider extends StorageProvider {
	#storage = new OrderedMap<string, StorageObject>();
	#content = new Map<string, ArrayBuffer>();
	#defaultExpirySeconds: number;

	constructor(options?: { defaultExpirySeconds?: number }) {
		super();
		this.#defaultExpirySeconds = options?.defaultExpirySeconds ?? 3600;
	}

	/** Clears all stored objects and releases memory. */
	[Symbol.dispose](): void {
		this.#storage.clear();
		this.#content.clear();
	}

	/**
	 * Stores a file with content and metadata.
	 * @param key The object key/path.
	 * @param content The file content.
	 * @param options Optional upload options (content-type, metadata).
	 */
	async put(
		key: string,
		content: ReadableStream<Uint8Array> | ArrayBuffer | Blob,
		options?: StorageUploadOptions,
	): Promise<void> {
		let buffer: ArrayBuffer;
		let size: number;
		if (content instanceof ArrayBuffer) {
			buffer = content;
			size = content.byteLength;
		} else if (content instanceof Blob) {
			buffer = await content.arrayBuffer();
			size = buffer.byteLength;
		} else {
			// ReadableStream<Uint8Array>
			const chunks: Uint8Array[] = [];
			const reader = content.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
			let totalLength = 0;
			for (const chunk of chunks) totalLength += chunk.byteLength;
			const merged = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				merged.set(chunk, offset);
				offset += chunk.byteLength;
			}
			buffer = merged.buffer;
			size = totalLength;
		}
		this.#content.set(key, buffer);
		this.#storage.set(key, {
			key,
			contentType: options?.contentType ?? "application/octet-stream",
			size,
			lastModified: new Date().toISOString(),
			metadata: options?.metadata ?? {},
			etag: crypto.randomUUID(),
		});
	}

	/**
	 * Retrieves the content of a stored file as a `ReadableStream`.
	 * @param key The object key/path.
	 * @returns A `ReadableStream` of the file content.
	 * @throws {@link StorageObjectNotFoundError} if the key does not exist.
	 */
	// deno-lint-ignore require-await
	async get(key: string): Promise<ReadableStream<Uint8Array>> {
		const buffer = this.#content.get(key);
		if (buffer === undefined && !this.#storage.has(key)) {
			throw new StorageObjectNotFoundError();
		}
		const bytes = buffer ? new Uint8Array(buffer) : new Uint8Array(0);
		return new ReadableStream<Uint8Array>({
			start(controller): void {
				controller.enqueue(bytes);
				controller.close();
			},
		});
	}

	// deno-lint-ignore require-await
	async getMetadata(
		key: string,
		_options?: { signal?: AbortSignal },
	): Promise<StorageObject> {
		const object = this.#storage.get(key);
		if (!object) {
			throw new StorageObjectNotFoundError();
		}
		return structuredClone(object);
	}

	// deno-lint-ignore require-await
	async getSignedUploadUrl(
		key: string,
		options?: StorageUploadOptions,
	): Promise<StorageSignedUrl> {
		const expirySeconds = options?.expirySeconds ?? this.#defaultExpirySeconds;
		const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
		// In-memory: generate a deterministic fake upload URL
		const url = `memory://upload/${key}`;
		// Side-effect: create or update the object metadata
		const now = new Date().toISOString();
		this.#storage.set(key, {
			key,
			contentType: options?.contentType ?? "application/octet-stream",
			size: 0,
			lastModified: now,
			metadata: options?.metadata ?? {},
			etag: crypto.randomUUID(),
		});
		return { url, expiresAt };
	}

	// deno-lint-ignore require-await
	async getSignedDownloadUrl(
		key: string,
		options?: StorageDownloadOptions,
	): Promise<StorageSignedUrl> {
		const object = this.#storage.get(key);
		if (!object) {
			throw new StorageObjectNotFoundError();
		}
		const expirySeconds = options?.expirySeconds ?? this.#defaultExpirySeconds;
		const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
		const url = `memory://download/${key}`;
		return { url, expiresAt };
	}

	// deno-lint-ignore require-await
	async delete(
		key: string,
		_options?: { signal?: AbortSignal },
	): Promise<void> {
		this.#storage.delete(key);
		this.#content.delete(key);
	}

	list(
		options: StorageListOptions,
	): ReadableStream<StorageListEntry> {
		const prefix = options.prefix;
		const cursor = options.cursor;
		const limit = options.limit ?? 100;
		const storage = this.#storage;

		return new ReadableStream<StorageListEntry>({
			start(controller): void {
				let started = !cursor;
				let count = 0;
				for (const [key, object] of storage.entries()) {
					if (!key.startsWith(prefix)) continue;
					if (!started) {
						if (key === cursor) {
							started = true;
						}
						continue;
					}
					if (count >= limit) break;
					controller.enqueue({ cursor: key, object: structuredClone(object) });
					count++;
				}
				controller.close();
			},
		});
	}
}
