import { AssetConfiguration } from "../../common/server/config/asset.ts";

export class AssetConfigurationBuilder {
	#enabled = false;

	setEnabled(enabled: boolean) {
		this.#enabled = !!enabled;
	}

	/**
	 * Finalize the {@see AssetConfiguration}
	 * @returns The finalized {@see AssetConfiguration} object
	 */
	public build(): AssetConfiguration {
		return {
			enabled: this.#enabled,
		};
	}
}
