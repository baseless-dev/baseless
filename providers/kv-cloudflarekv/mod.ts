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
/// <reference types="https://esm.sh/v132/@cloudflare/workers-types@4.20230914.0/index.d.ts" />

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class CloudFlareKVProvider implements KVProvider {
	#logger = createLogger("kv-cloudflarekv");
	#storage: KVNamespace;

	public constructor(
		storage: any,
	) {
		this.#storage = storage;
	}

	async get(key: string[], options?: KVGetOptions | undefined): Promise<KVKey> {
		const keyString = keyPathToKeyString(key);
		const result = await this.#storage.getWithMetadata<{ expiration: number }>(
			keyString,
			{ type: "text", cacheTtl: options?.cacheTtl },
		);
		if (result.value === null) {
			throw new KVKeyNotFoundError();
		}
		return {
			key,
			value: result.value,
			expiration: result.metadata?.expiration,
		};
	}

	async put(
		key: string[],
		value: string,
		options?: KVPutOptions | undefined,
	): Promise<void> {
		const keyString = keyPathToKeyString(key);
		const expiration = options?.expiration
			? options.expiration instanceof Date
				? options.expiration.getTime() / 1000 >> 0
				: (options.expiration + new Date().getTime()) / 1000 >> 0
			: undefined;
		await this.#storage.put(keyString, value, {
			expiration,
			metadata: { expiration },
		});
	}

	async list(
		{ prefix, cursor = "", limit = 10 }: KVListOptions,
	): Promise<KVListResult> {
		const prefixString = keyPathToKeyString(prefix);
		const cursorString = cursor;
		const results = await this.#storage.list<{ expiration: number }>({
			prefix: prefixString,
			cursor: cursorString,
			limit,
		});

		return {
			done: results.list_complete,
			next: results.list_complete === false ? results.cursor : undefined,
			keys: results.keys.map((key) => ({
				key: keyStringToKeyPath(key.name),
				expiration: key.metadata?.expiration,
			})),
		};
	}

	delete(key: string[]): Promise<void> {
		const prefixString = keyPathToKeyString(key);
		return this.#storage.delete(prefixString);
	}
}
