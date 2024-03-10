import { Application } from "../../lib/application/application.ts";
import { IdentityConfiguration } from "./configuration.ts";
import type { IdentityContext } from "./context.ts";
import { IdentityService } from "./identity.ts";

export { IdentityConfiguration } from "./configuration.ts";

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
	return new Application()
		.derive(() => {
			const context: IdentityContext = {
				identity: new IdentityService(configuration.identityProvider),
			};
			return context;
		});
};

export default identity;
