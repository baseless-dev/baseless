import { Application } from "../../lib/application/application.ts";
import type { AssetContext } from "./context.ts";
import { AssetService } from "./asset.ts";
import { AssetConfiguration } from "./configuration.ts";

export { AssetConfiguration } from "./configuration.ts";

export const asset = (
	builder:
		| AssetConfiguration
		| ((configuration: AssetConfiguration) => AssetConfiguration),
) => {
	const configuration = builder instanceof AssetConfiguration
		? builder.build()
		: builder(new AssetConfiguration()).build();
	return new Application()
		.derive(() => {
			const context: AssetContext = {
				asset: new AssetService(configuration.assetProvider),
			};
			return context;
		})
		.get("/{...rest}", ({ request, asset }) => asset.fetch(request), {
			detail: {
				summary: "Static Asset",
				description: "Fetches a static asset from the asset provider",
				tags: ["Asset"],
			},
			response: {
				200: {
					description: "The static asset",
				},
				404: {
					description: "The static asset was not found",
				},
			},
		});
};

export default asset;
