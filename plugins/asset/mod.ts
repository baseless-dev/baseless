import type { AssetProvider } from "../../providers/asset.ts";
import { Router } from "../../common/router/router.ts";
import type { Context } from "./context.ts";
import { AssetService } from "./asset.ts";

export type AssetOptions = {
	asset: AssetProvider;
};

// deno-lint-ignore explicit-function-return-type
export default function assetPlugin(
	options: AssetOptions,
) {
	return new Router()
		.decorate((_) => {
			const context: Context = {
				get asset() {
					return new AssetService(options.asset);
				},
			};
			return context;
		})
		.get("/{...asset}", ({ request, asset }) => asset.fetch(request), {
			summary: "Static Asset",
			description: "Fetches a static asset from the asset provider",
			tags: ["Asset"],
			response: {
				200: {
					description: "The asset's content",
					content: {
						"application/octet-stream": {
							schema: {
								type: "string",
								format: "binary",
							},
						},
					},
				},
				404: {
					description: "The asset was not found",
				},
			},
		});
}
