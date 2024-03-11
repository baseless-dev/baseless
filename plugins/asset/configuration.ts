import type { AssetProvider } from "../../providers/asset/provider.ts";

export class AssetConfiguration {
	#assetProvider?: AssetProvider;

	constructor(assetProvider?: AssetProvider) {
		this.#assetProvider = assetProvider;
	}

	setAssetProvider(assetProvider: AssetProvider): AssetConfiguration {
		return new AssetConfiguration(assetProvider);
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#assetProvider) {
			throw new Error("An asset provider must be provided.");
		}
		return Object.freeze({
			assetProvider: this.#assetProvider,
		});
	}
}
