import { Router } from "../../lib/router/router.ts";
import { SessionConfiguration } from "./configuration.ts";
import type { SessionContext } from "./context.ts";
import { SessionService } from "./session.ts";

export { SessionConfiguration } from "./configuration.ts";

export const session = (
	builder:
		| SessionConfiguration
		| ((
			configuration: SessionConfiguration,
		) => SessionConfiguration),
) => {
	const configuration = builder instanceof SessionConfiguration
		? builder.build()
		: builder(new SessionConfiguration()).build();
	return new Router()
		.derive(() => {
			const context: SessionContext = {
				session: new SessionService(configuration.sessionProvider),
			};
			return context;
		});
};

export default session;
