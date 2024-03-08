import { Router } from "../../lib/router/router.ts";
import { KVConfiguration } from "./configuration.ts";
import type { KVContext } from "./context.ts";
import { KVService } from "./kv.ts";

export { KVConfiguration } from "./configuration.ts";

export const kv = (
	builder:
		| KVConfiguration
		| ((
			configuration: KVConfiguration,
		) => KVConfiguration),
) => {
	const configuration = builder instanceof KVConfiguration
		? builder.build()
		: builder(new KVConfiguration()).build();
	return new Router()
		.derive(() => {
			const context: KVContext = {
				kv: new KVService(configuration.kvProvider),
			};
			return context;
		});
};

export default kv;
