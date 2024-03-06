import type { CounterService } from "./counter.ts";

export interface Context {
	readonly counter: CounterService;
}
