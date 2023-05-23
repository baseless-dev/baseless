export type AssetConfiguration = {
	readonly enabled: boolean;
};

export class AssetConfigurationBuilder {
	#enabled = false;

	setEnabled(enabled: boolean): this {
		this.#enabled = !!enabled;
		return this;
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
