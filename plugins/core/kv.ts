import type {
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
		key: string[],
		options?: KVGetOptions,
	): Promise<KVKey> {
		// TODO security rules
		return this.#kvProvider.get(key, options);
	}

	put(
		key: string[],
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

	delete(key: string[]): Promise<void> {
		// TODO security rules
		return this.#kvProvider.delete(key);
	}
}
