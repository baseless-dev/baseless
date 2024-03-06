import { Router } from "../../lib/router/router.ts";
import { CounterConfiguration } from "./configuration.ts";
import type { Context } from "./context.ts";
import { CounterService } from "./counter.ts";

export const counter = (
	builder:
		| CounterConfiguration
		| ((
			configuration: CounterConfiguration,
		) => CounterConfiguration),
) => {
	const configuration = builder instanceof CounterConfiguration
		? builder.build()
		: builder(new CounterConfiguration()).build();
	return new Router()
		.derive(() => {
			const context: Context = {
				counter: new CounterService(configuration.counterProvider),
			};
			return context;
		});
};

export default counter;
