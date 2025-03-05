import {
	type KVGetOptions,
	type KVKey,
	KVKeyNotFoundError,
	type KVListKey,
	type KVListOptions,
	type KVListResult,
	KVProvider,
	KVPutError,
	type KVPutOptions,
} from "@baseless/server";
import { fromKvKey, toKvKey } from "./utils.ts";

export class DenoKVProvider extends KVProvider {
	#storage: Deno.Kv;

	constructor(
		storage: Deno.Kv,
	) {
		super();
		this.#storage = storage;
	}

	async get(key: string, _options?: KVGetOptions): Promise<KVKey> {
		const now = new Date().getTime();
		const value = await this.#storage.get<
			{ value: string; expiration: number }
		>(
			toKvKey(key),
			{
				consistency: "strong",
			},
		);
		if (
			value.versionstamp && value.value &&
			(!value.value.expiration || value.value.expiration > now)
		) {
			return {
				key,
				value: value.value.value,
				expiration: undefined,
			};
		}
		throw new KVKeyNotFoundError();
	}
	async put(key: string, value: unknown, options?: KVPutOptions): Promise<void> {
		const expireIn = options?.expiration
			? options.expiration instanceof Date ? options.expiration.getTime() - new Date().getTime() : options.expiration
			: undefined;
		const expiration = options?.expiration
			? options.expiration instanceof Date ? options.expiration.getTime() : options.expiration + new Date().getTime()
			: undefined;
		const result = await this.#storage.set(toKvKey(key), { value, expiration }, { expireIn });
		if (!result.ok) {
			throw new KVPutError();
		}
	}
	async list(options: KVListOptions): Promise<KVListResult> {
		const now = new Date().getTime();
		const results = await this.#storage.list<
			{ value: string; expiration: number }
		>({
			prefix: toKvKey(options.prefix),
		}, {
			consistency: "eventual",
			limit: options.limit,
			cursor: options.cursor,
		});
		const keys: KVListKey[] = [];
		for await (const key of results) {
			if (!key.value.expiration || key.value.expiration < now) {
				keys.push({
					key: fromKvKey(key.key),
					expiration: undefined,
				});
			}
		}
		return {
			done: results.cursor === "",
			keys,
			next: results.cursor,
		};
	}
	delete(key: string): Promise<void> {
		return this.#storage.delete(toKvKey(key));
	}
}
