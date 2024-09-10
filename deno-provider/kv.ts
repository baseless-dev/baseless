import {
	KVGetOptions,
	KVKey,
	KVKeyNotFoundError,
	KVListKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutError,
	KVPutOptions,
} from "@baseless/server/kv-provider";

export class DenoKVProvider extends KVProvider {
	#storage: Deno.Kv;

	constructor(
		storage: Deno.Kv,
	) {
		super();
		this.#storage = storage;
	}

	async get(key: string[], _options?: KVGetOptions): Promise<KVKey> {
		const now = new Date().getTime();
		const value = await this.#storage.get<
			{ value: string; expiration: number }
		>(
			key,
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
	async put(key: string[], value: unknown, options?: KVPutOptions): Promise<void> {
		const expireIn = options?.expiration
			? options.expiration instanceof Date ? options.expiration.getTime() - new Date().getTime() : options.expiration
			: undefined;
		const expiration = options?.expiration
			? options.expiration instanceof Date ? options.expiration.getTime() : options.expiration + new Date().getTime()
			: undefined;
		const result = await this.#storage.set(key, { value, expiration }, { expireIn });
		if (!result.ok) {
			throw new KVPutError();
		}
	}
	async list(options: KVListOptions): Promise<KVListResult> {
		const now = new Date().getTime();
		const results = await this.#storage.list<
			{ value: string; expiration: number }
		>({
			prefix: options.prefix,
		}, {
			consistency: "eventual",
			limit: options.limit,
			cursor: options.cursor,
		});
		const keys: KVListKey[] = [];
		for await (const key of results) {
			if (!key.value.expiration || key.value.expiration < now) {
				keys.push({
					key: key.key as string[],
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
	delete(key: string[]): Promise<void> {
		return this.#storage.delete(key);
	}
}
