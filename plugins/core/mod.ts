import { Router } from "../../common/router/router.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { DocumentProvider } from "../../providers/document.ts";
import type { KVProvider } from "../../providers/kv.ts";
import { CounterService } from "./counter.ts";
import { DocumentService } from "./document.ts";
import { KVService } from "./kv.ts";
import type { Context } from "./context.ts";

export type Options = {
	counter: CounterProvider;
	kv: KVProvider;
	document: DocumentProvider;
};

// deno-lint-ignore explicit-function-return-type
export default function core(
	options: Options,
) {
	const { counter, kv, document } = options;

	return new Router<{ waitUntil: Array<PromiseLike<void>> }>()
		.decorate((_, { waitUntil }) => {
			const context: Context = {
				get counter() {
					return new CounterService(counter);
				},
				get kv() {
					return new KVService(kv);
				},
				get document() {
					return new DocumentService(document);
				},
				waitUntil(promise: PromiseLike<void>): void {
					waitUntil.push(promise);
				},
			};
			return context;
		});
}
