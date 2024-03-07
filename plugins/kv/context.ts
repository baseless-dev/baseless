import type { KVService } from "./kv.ts";

export interface KVContext {
	readonly kv: KVService;
}
