import {
	KeyNotFoundError,
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "../../server/providers/kv.ts";
import { createLogger } from "../../server/logger.ts";

export class WebStorageKVProvider implements KVProvider {
	protected readonly logger = createLogger("baseless-kv-webstorage");

	public constructor(
		protected readonly storage: Storage,
		protected readonly prefix = "kv",
	) {
	}

	// deno-lint-ignore require-await
	async get(
		key: string,
		_options?: KVGetOptions,
	): Promise<KVKey> {
		const json = this.storage.getItem(`${this.prefix}${key}`);
		if (json === null) {
			this.logger.debug(`Key "${key}" does not exists.`);
			throw new KeyNotFoundError(key);
		}
		let obj: Record<string, unknown>;
		try {
			obj = JSON.parse(json) ?? {};
		} catch (inner) {
			this.logger.error(
				`Coudn't parse JSON for key "${key}", got error : ${inner}.`,
			);
			const err = new KeyNotFoundError(key);
			err.cause = inner;
			throw err;
		}
		const value = typeof obj.value === "string" ? obj.value.toString() : "";
		const expiration: number | undefined = typeof obj.expiration === "number"
			? obj.expiration
			: undefined;
		if (expiration && Date.now() > expiration) {
			this.storage.removeItem(`/${this.prefix}${key}`);
			this.logger.debug(`Key "${key}" does not exists.`);
			throw new KeyNotFoundError(key);
		}
		return {
			key,
			value: value,
			expiration,
		};
	}

	// deno-lint-ignore require-await
	async put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): Promise<void> {
		const expiration = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime()
				: options.expiration + new Date().getTime()
			: null;
		this.storage.setItem(
			`${this.prefix}${key}`,
			JSON.stringify({ value, expiration }),
		);
		this.logger.debug(`Key "${key}" set.`);
	}

	async list(
		{ prefix, cursor = "", limit = 10 }: KVListOptions,
	): Promise<KVListResult> {
		const prefixStart = this.prefix.length;
		const prefixEnd = this.prefix.length + prefix.length;
		const keys: KVKey[] = [];
		let count = 0;
		for (let i = 0, l = this.storage.length; i < l && count < limit; ++i) {
			const key = this.storage.key(i);
			if (
				key?.substring(0, prefixStart) === this.prefix &&
				key?.substring(prefixStart, prefixEnd) === prefix &&
				key.substring(prefixStart) > cursor
			) {
				count++;
				keys.push(await this.get(key.substring(prefixStart)));
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
		this.storage.removeItem(`${this.prefix}${key}`);
		this.logger.debug(`Key "${key}" deleted.`);
	}
}