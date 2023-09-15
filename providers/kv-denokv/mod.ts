import { KVKeyNotFoundError, KVPutError } from "../../common/kv/errors.ts";
import { createLogger } from "../../common/system/logger.ts";
import type {
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "../kv.ts";

export class DenoKVProvider implements KVProvider {
	#logger = createLogger("baseless-kv-denokv");

	public constructor(
		protected readonly storage: Deno.Kv,
	) {
	}

	async get(
		key: string[],
		_options?: KVGetOptions | undefined,
	): Promise<KVKey> {
		const now = new Date().getTime();
		const value = await this.storage.get<{ value: string; expiration: number }>(
			key,
			{
				consistency: "eventual",
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

	async put(
		key: string[],
		value: string,
		options?: KVPutOptions | undefined,
	): Promise<void> {
		const expireIn = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime() - new Date().getTime()
				: options.expiration
			: undefined;
		const expiration = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime()
				: options.expiration + new Date().getTime()
			: undefined;
		const result = await this.storage.set(key, { value, expiration }, {
			expireIn,
		});
		if (!result.ok) {
			throw new KVPutError();
		}
	}
	async list(options: KVListOptions): Promise<KVListResult> {
		const now = new Date().getTime();
		const results = await this.storage.list<
			{ value: string; expiration: number }
		>({
			prefix: options.prefix,
		}, {
			consistency: "eventual",
			limit: options.limit,
			cursor: options.cursor,
		});
		const keys: KVKey[] = [];
		for await (const key of results) {
			if (!key.value.expiration || key.value.expiration < now) {
				keys.push({
					key: key.key as string[],
					value: key.value.value,
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

	async delete(key: string[]): Promise<void> {
		await this.storage.delete(key);
	}
}
