import { KVKeyNotFoundError, KVPutError } from "../../common/kv/errors.ts";
import { createLogger } from "../../common/system/logger.ts";
import { PromisedResult, err, isResultOk, ok } from "../../common/system/result.ts";
import { KVGetOptions, KVKey, KVListOptions, KVListResult, KVProvider, KVPutOptions } from "../kv.ts";

export class WebStorageKVProvider implements KVProvider {
	#logger = createLogger("baseless-kv-webstorage");

	public constructor(
		protected readonly storage: Storage,
		protected readonly prefix = "kv",
	) {
	}

	// deno-lint-ignore require-await
	async get(
		key: string,
		_options?: KVGetOptions,
	): PromisedResult<KVKey, KVKeyNotFoundError> {
		const json = this.storage.getItem(`${this.prefix}${key}`);
		if (json === null) {
			this.#logger.debug(`Key "${key}" does not exists.`);
			return err(new KVKeyNotFoundError());
		}
		let obj: Record<string, unknown>;
		try {
			obj = JSON.parse(json) ?? {};
		} catch (inner) {
			this.#logger.error(
				`Coudn't parse JSON for key "${key}", got error : ${inner}.`,
			);
			return err(new KVKeyNotFoundError());
		}
		const value = typeof obj.value === "string" ? obj.value.toString() : "";
		const expiration: number | undefined = typeof obj.expiration === "number"
			? obj.expiration
			: undefined;
		if (expiration && Date.now() > expiration) {
			this.storage.removeItem(`/${this.prefix}${key}`);
			this.#logger.debug(`Key "${key}" does not exists.`);
			return err(new KVKeyNotFoundError());
		}
		return ok({
			key,
			value: value,
			expiration,
		});
	}

	// deno-lint-ignore require-await
	async put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): PromisedResult<void, KVPutError> {
		const expiration = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime()
				: options.expiration + new Date().getTime()
			: null;
		this.storage.setItem(
			`${this.prefix}${key}`,
			JSON.stringify({ value, expiration }),
		);
		this.#logger.debug(`Key "${key}" set.`);
		return ok();
	}

	async list(
		{ prefix, cursor = "", limit = 10 }: KVListOptions,
	): PromisedResult<KVListResult, never> {
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
				const result = await this.get(key.substring(prefixStart));
				if (isResultOk(result)) {
					keys.push(result.value);
				}
				if (count >= limit) {
					break;
				}
			}
		}
		const done = count !== limit;
		return ok({
			keys: keys as unknown as ReadonlyArray<KVKey>,
			done,
			next: done ? undefined : keys.at(-1)?.key,
		});
	}

	// deno-lint-ignore require-await
	async delete(key: string): PromisedResult<void, never> {
		this.storage.removeItem(`${this.prefix}${key}`);
		this.#logger.debug(`Key "${key}" deleted.`);
		return ok();
	}
}
