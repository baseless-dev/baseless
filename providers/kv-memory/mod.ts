import { CacheMap } from "../../shared/cachemap.ts";
import { createLogger } from "../../server/logger.ts";
import {
	KeyNotFoundError,
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "../../server/providers/kv.ts";

type Item = { value: string; expiration?: number };

function isItem(value?: unknown): value is Item {
	return !!value && typeof value === "object" && "value" in value &&
		typeof value.value === "string" &&
		(!("expiration" in value) || value.expiration === undefined ||
			("expiration" in value && typeof value.expiration === "number"));
}

function assertItem(value?: unknown): asserts value is Item {
	if (!isItem(value)) {
		throw new Error(`Expected value to be an Item, got ${value}.`);
	}
}

export class MemoryKVProvider implements KVProvider {
	#logger = createLogger("kv-memory");
	#cache = new CacheMap<string, Item>();

	// deno-lint-ignore require-await
	async get(
		key: string,
		_options?: KVGetOptions,
	): Promise<KVKey> {
		const item = this.#cache.get(key);
		if (!item) {
			throw new KeyNotFoundError();
		}
		assertItem(item);
		return {
			key,
			...item,
		};
	}

	// deno-lint-ignore require-await
	async put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): Promise<void> {
		const now = new Date().getTime();
		const expiration = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime()
				: options.expiration + now
			: undefined;
		const item: Item = { value, expiration };
		this.#cache.set(key, item, expiration ? expiration - now : undefined);
	}

	async list(
		{ prefix, cursor = "", limit = 10 }: KVListOptions,
	): Promise<KVListResult> {
		const prefixEnd = prefix.length;
		const keys: KVKey[] = [];
		let count = 0;
		for (const [key] of this.#cache.entries()) {
			if (
				key?.substring(0, prefixEnd) === prefix &&
				key.substring(0) > cursor
			) {
				count++;
				keys.push(await this.get(key));
				if (count >= limit) {
					break;
				}
			}
		}
		const done = count !== limit;
		return {
			keys: keys as unknown as ReadonlyArray<KVKey>,
			done,
			next: done ? undefined : keys.at(-1)?.key,
		};
	}

	// deno-lint-ignore require-await
	async delete(key: string): Promise<void> {
		this.#cache.delete(key);
	}
}
