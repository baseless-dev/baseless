import { KVKeyNotFoundError, KVPutError } from "../../common/kv/errors.ts";
import { PromisedResult } from "../../common/system/result.ts";
import {
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "../../providers/kv.ts";

export class KVService {
	#kvProvider: KVProvider;

	constructor(kvProvider: KVProvider) {
		this.#kvProvider = kvProvider;
	}

	get(
		key: string,
		options?: KVGetOptions,
	): PromisedResult<KVKey, KVKeyNotFoundError> {
		// TODO security rules
		return this.#kvProvider.get(key, options);
	}

	put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): PromisedResult<void, KVPutError> {
		// TODO security rules
		return this.#kvProvider.put(key, value, options);
	}

	list(options: KVListOptions): PromisedResult<KVListResult, never> {
		// TODO security rules
		return this.#kvProvider.list(options);
	}

	delete(key: string): PromisedResult<void, KVKeyNotFoundError> {
		// TODO security rules
		return this.#kvProvider.delete(key);
	}
}
