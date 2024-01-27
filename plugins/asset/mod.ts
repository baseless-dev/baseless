import type { AssetProvider } from "../../providers/asset.ts";
import type { Elysia } from "../../deps.ts";
import type { Context } from "./context.ts";
import { AssetService } from "./asset.ts";

export type AssetOptions = {
	asset: AssetProvider;
};

export const asset = (
	options: AssetOptions,
) =>
(app: Elysia) => {
	return app
		.derive(() => {
			const context: Context = {
				get asset() {
					return new AssetService(options.asset);
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
