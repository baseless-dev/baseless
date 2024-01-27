import type { CounterProvider } from "../../providers/counter.ts";
import type { DocumentProvider } from "../../providers/document.ts";
import type { KVProvider } from "../../providers/kv.ts";
import { CounterService } from "./counter.ts";
import { DocumentService } from "./document.ts";
import { KVService } from "./kv.ts";
import type { Context } from "./context.ts";
import type { Elysia } from "../../deps.ts";

export type Options = {
	counter: CounterProvider;
	kv: KVProvider;
	document: DocumentProvider;
};

export const core = (
	options: Options,
) =>
(app: Elysia) => {
	const { counter, kv, document } = options;

	return app.derive(() => {
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
		};
		return context;
	});
};

export default core;
