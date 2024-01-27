import type { CounterService } from "./counter.ts";
import type { DocumentService } from "./document.ts";
import type { KVService } from "./kv.ts";

export interface Context {
	readonly counter: CounterService;
	readonly kv: KVService;
	readonly document: DocumentService;
}
