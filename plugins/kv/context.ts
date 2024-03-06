import type { KVService } from "./kv.ts";

export interface Context {
	readonly kv: KVService;
}
