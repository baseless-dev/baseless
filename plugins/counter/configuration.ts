import type { CounterProvider } from "../../providers/counter.ts";

export class CounterConfiguration {
	#counterProvider?: CounterProvider;

	constructor(counterProvider?: CounterProvider) {
		this.#counterProvider = counterProvider;
	}

	setCounterProvider(counterProvider: CounterProvider): CounterConfiguration {
		return new CounterConfiguration(counterProvider);
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#counterProvider) {
			throw new Error("A counter provider must be provided.");
		}
		return Object.freeze({
			counterProvider: this.#counterProvider,
		});
	}
}
