// deno-lint-ignore no-unused-vars
import { KVKeyNotFoundError, KVPutError } from "../../common/kv/errors.ts";
import type { IKVService } from "../../common/server/services/kv.ts";
import type {
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "../../providers/kv.ts";

export class KVService implements IKVService {
	#kvProvider: KVProvider;

	constructor(kvProvider: KVProvider) {
		this.#kvProvider = kvProvider;
	}

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	get(
		key: string,
		options?: KVGetOptions,
	): Promise<KVKey> {
		// TODO security rules
		return this.#kvProvider.get(key, options);
	}

	/**
	 * @throws {KVPutError}
	 */
	put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): Promise<void> {
		// TODO security rules
		return this.#kvProvider.put(key, value, options);
	}

	list(options: KVListOptions): Promise<KVListResult> {
		// TODO security rules
		return this.#kvProvider.list(options);
	}

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	delete(key: string): Promise<void> {
		// TODO security rules
		return this.#kvProvider.delete(key);
	}
}
