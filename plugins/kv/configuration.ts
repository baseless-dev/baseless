import type { KVProvider } from "../../providers/kv/provider.ts";

export class KVConfiguration {
	#kvProvider?: KVProvider;

	constructor(kvProvider?: KVProvider) {
		this.#kvProvider = kvProvider;
	}

	setKVProvider(kvProvider: KVProvider): KVConfiguration {
		return new KVConfiguration(kvProvider);
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#kvProvider) {
			throw new Error("A KV provider must be provided.");
		}
		return Object.freeze({
			kvProvider: this.#kvProvider,
		});
	}
}
