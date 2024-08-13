// deno-lint-ignore-file require-await
import {
	KVGetOptions,
	KVKey,
	KVKeyNotFoundError,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "@baseless/server/provider";

export class MemoryKVProvider extends KVProvider {
	#storage = new Map<string, { value: unknown; expiration?: number }>();

	public clearExpired(): void {
		const now = Date.now();
		for (const [key, data] of this.#storage) {
			if (data.expiration && data.expiration <= now) {
				this.#storage.delete(key);
			}
		}
	}

	async get(key: string[], _options?: KVGetOptions): Promise<KVKey> {
		const keyString = keyPathToKeyString(key);
		const item = this.#storage.get(keyString);
		if (!item || (item.expiration && item.expiration < new Date().getTime())) {
			throw new KVKeyNotFoundError();
		}
		return {
			...structuredClone(item),
			key,
		};
	}
	async put(key: string[], value: unknown, options?: KVPutOptions): Promise<void> {
		const now = new Date().getTime();
		const expiration = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime()
				: options.expiration + now
			: undefined;
		const item = { value, expiration };
		const keyString = keyPathToKeyString(key);
		this.#storage.set(keyString, item);
	}
	async list(
		{ prefix, cursor = "", limit = Number.MAX_VALUE }: KVListOptions,
	): Promise<KVListResult> {
		const prefixString = keyPathToKeyString(prefix);
		const prefixLength = prefixString.length;
		const cursorString = cursor;
		const keys = [];
		let count = 0;
		for (const [key, value] of this.#storage.entries()) {
			if (
				key?.substring(0, prefixLength) === prefixString &&
				key > cursorString
			) {
				count++;
				const keyPath = keyStringToKeyPath(key);
				const { expiration } = value;
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
	async delete(key: string[]): Promise<void> {
		const keyString = keyPathToKeyString(key);
		this.#storage.delete(keyString);
	}
}

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}
