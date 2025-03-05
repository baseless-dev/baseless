// deno-lint-ignore-file require-await
import { KVGetOptions, KVKey, KVKeyNotFoundError, KVListOptions, KVListResult, KVProvider, KVPutOptions } from "@baseless/server";

export class MemoryKVProvider extends KVProvider {
	#storage = new Map<string, { value: unknown; expiration?: number }>();

	[Symbol.dispose](): void {
		this.#storage.clear();
	}

	public clearExpired(): void {
		const now = Date.now();
		for (const [key, data] of this.#storage) {
			if (data.expiration && data.expiration <= now) {
				this.#storage.delete(key);
			}
		}
	}

	async get(key: string, _options?: KVGetOptions): Promise<KVKey> {
		const item = this.#storage.get(key);
		if (!item || (item.expiration && item.expiration < new Date().getTime())) {
			throw new KVKeyNotFoundError();
		}
		return {
			...structuredClone(item),
			key,
		};
	}
	async put(key: string, value: unknown, options?: KVPutOptions): Promise<void> {
		const now = new Date().getTime();
		const expiration = options?.expiration
			? options.expiration instanceof Date ? options.expiration.getTime() : options.expiration + now
			: undefined;
		const item = { value, expiration };
		this.#storage.set(key, item);
	}
	async list(
		{ prefix, cursor = "", limit = Number.MAX_VALUE }: KVListOptions,
	): Promise<KVListResult> {
		const prefixLength = prefix.length;
		const cursorString = cursor;
		const keys = [];
		let count = 0;
		for (const [key, value] of this.#storage.entries()) {
			if (
				key?.substring(0, prefixLength) === prefix &&
				key > cursorString
			) {
				count++;
				const { expiration } = value;
				keys.push({ key, expiration });
				if (count >= limit) {
					break;
				}
			}
		}
		const done = count !== limit;
		return {
			keys: keys as unknown as ReadonlyArray<KVKey>,
			done,
			next: done ? undefined : keys.at(-1)!.key,
		};
	}
	async delete(key: string): Promise<void> {
		this.#storage.delete(key);
	}
}
