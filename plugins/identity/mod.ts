import { Router } from "../../lib/router/router.ts";
import { IdentityConfiguration } from "./configuration.ts";
import type { IdentityContext } from "./context.ts";
import { IdentityService } from "./identity.ts";

export const identity = (
	builder:
		| IdentityConfiguration
		| ((
			configuration: IdentityConfiguration,
		) => IdentityConfiguration),
) => {
	const configuration = builder instanceof IdentityConfiguration
		? builder.build()
		: builder(new IdentityConfiguration()).build();
	return new Router()
		.derive(() => {
			const context: IdentityContext = {
				identity: new IdentityService(configuration.identityProvider),
			};
			return context;
		});
};

export default identity;
