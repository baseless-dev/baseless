import { CacheMap } from "../../common/collections/cachemap.ts";
// deno-lint-ignore no-unused-vars
import { KVKeyNotFoundError, KVPutError } from "../../common/kv/errors.ts";
import { createLogger } from "../../common/system/logger.ts";
import type {
	KVGetOptions,
	KVKey,
	KVListKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "../kv.ts";

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

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class MemoryKVProvider implements KVProvider {
	#logger = createLogger("kv-memory");
	#cache = new CacheMap<string, Item>();

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	// deno-lint-ignore require-await
	async get(
		key: string[],
		_options?: KVGetOptions,
	): Promise<KVKey> {
		const keyString = keyPathToKeyString(key);
		const item = this.#cache.get(keyString);
		if (!item) {
			throw new KVKeyNotFoundError();
		}
		assertItem(item);
		return {
			key,
			...item,
		};
	}

	/**
	 * @throws {KVPutError}
	 */
	// deno-lint-ignore require-await
	async put(
		key: string[],
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
		const keyString = keyPathToKeyString(key);
		this.#cache.set(keyString, item, expiration ? expiration - now : undefined);
	}

	async list(
		{ prefix, cursor = "", limit = 10 }: KVListOptions,
	): Promise<KVListResult> {
		const prefixString = keyPathToKeyString(prefix);
		const prefixLength = prefixString.length;
		const cursorString = cursor;
		const keys: KVListKey[] = [];
		let count = 0;
		for (const [key] of this.#cache.entries()) {
			if (
				key?.substring(0, prefixLength) === prefixString &&
				key > cursorString
			) {
				count++;
				const keyPath = keyStringToKeyPath(key);
				const { expiration } = await this.get(keyPath);
				keys.push({ key: keyPath, expiration });
				if (count >= limit) {
					break;
				}
			}
		}
		const done = count !== limit;
		return {
			keys: keys as unknown as ReadonlyArray<KVKey>,
			done,
			next: done ? undefined : keyPathToKeyString(keys.at(-1)!.key),
		};
	}

	// deno-lint-ignore require-await
	async delete(key: string[]): Promise<void> {
		const keyString = keyPathToKeyString(key);
		this.#cache.delete(keyString);
	}
}
