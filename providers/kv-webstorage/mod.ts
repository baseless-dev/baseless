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

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class WebStorageKVProvider implements KVProvider {
	#logger = createLogger("kv-webstorage");

	public constructor(
		protected readonly storage: Storage,
		protected readonly prefix = "kv",
	) {
	}

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	// deno-lint-ignore require-await
	async get(
		key: string[],
		_options?: KVGetOptions,
	): Promise<KVKey> {
		const keyString = keyPathToKeyString([this.prefix, ...key]);
		const json = this.storage.getItem(keyString);
		if (json === null) {
			this.#logger.debug(`Key "${keyString}" does not exists.`);
			throw new KVKeyNotFoundError();
		}
		let obj: Record<string, unknown>;
		try {
			obj = JSON.parse(json) ?? {};
		} catch (inner) {
			this.#logger.error(
				`Coudn't parse JSON for key "${keyString}", got error : ${inner}.`,
			);
			throw new KVKeyNotFoundError();
		}
		const value = typeof obj.value === "string" ? obj.value.toString() : "";
		const expiration: number | undefined = typeof obj.expiration === "number"
			? obj.expiration
			: undefined;
		if (expiration && Date.now() > expiration) {
			this.storage.removeItem(keyString);
			this.#logger.debug(`Key "${keyString}" does not exists.`);
			throw new KVKeyNotFoundError();
		}
		return {
			key,
			value: value,
			expiration,
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
		const expiration = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime()
				: options.expiration + new Date().getTime()
			: null;
		const keyString = keyPathToKeyString([this.prefix, ...key]);
		this.storage.setItem(
			keyString,
			JSON.stringify({ value, expiration }),
		);
		this.#logger.debug(`Key "${keyString}" set.`);
	}

	async list(
		{ prefix, cursor = "", limit }: KVListOptions,
	): Promise<KVListResult> {
		const prefixString = keyPathToKeyString([this.prefix, ...prefix]);
		const prefixLength = prefixString.length;
		const cursorString = keyPathToKeyString([
			this.prefix,
			...keyStringToKeyPath(cursor),
		]);
		const keys: KVListKey[] = [];
		let count = 0;
		limit ??= Number.MAX_VALUE;
		for (let i = 0, l = this.storage.length; i < l && count < limit; ++i) {
			const key = this.storage.key(i);
			if (
				key?.substring(0, prefixLength) === prefixString &&
				key > cursorString
			) {
				count++;
				const keyPath = keyStringToKeyPath(
					key.substring(this.prefix.length + 1),
				);
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
		const keyString = keyPathToKeyString([this.prefix, ...key]);
		this.storage.removeItem(keyString);
		this.#logger.debug(`Key "${keyString}" deleted.`);
	}
}
