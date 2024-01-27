import type { AssetProvider } from "../../providers/asset.ts";
import type { Elysia } from "../../deps.ts";

export type AssetOptions = {
	asset: AssetProvider;
};

export const asset = (
	options: AssetOptions,
) =>
(app: Elysia) => {
	return app
		.decorate(() => {
			const context = {
				get asset() {
					return options.asset;
				},
			};
			return context;
		})
		.get("/*", ({ request, asset }) => asset.fetch(request), {
			detail: {
				summary: "Static Asset",
				description: "Fetches a static asset from the asset provider",
				tags: ["Asset"],
			},
		});
};

export default asset;
