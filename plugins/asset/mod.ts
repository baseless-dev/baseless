import type { AssetProvider } from "../../providers/asset.ts";
import { Router } from "../../lib/router/router.ts";
import type { Context } from "./context.ts";
import { AssetService } from "./asset.ts";

export type AssetOptions = {
	asset: AssetProvider;
};

export const asset = (
	options: AssetOptions,
) => {
	return new Router()
		.derive(() => {
			const context: Context = {
				asset: new AssetService(options.asset),
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
