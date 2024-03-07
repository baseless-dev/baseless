import type { CounterService } from "./counter.ts";

export interface CounterContext {
	readonly counter: CounterService;
}
