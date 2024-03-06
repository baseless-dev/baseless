import type { KVProvider } from "../../providers/kv.ts";

export class KVConfiguration {
	#kvProvider?: KVProvider;

	constructor(counterProvider?: KVProvider) {
		this.#kvProvider = counterProvider;
	}

	setKVProvider(counterProvider: KVProvider): KVConfiguration {
		return new KVConfiguration(counterProvider);
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
