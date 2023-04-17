import { AssetConfiguration, AssetConfigurationBuilder } from "./asset/config.ts";
import { AuthenticationConfigurationBuilder, AuthenticationConfiguration } from "./auth/config.ts";

export interface Configuration {
	readonly asset: AssetConfiguration;
	readonly auth: AuthenticationConfiguration;
}

export class ConfigurationBuilder {
	#asset = new AssetConfigurationBuilder();
	#auth = new AuthenticationConfigurationBuilder();

	/**
	 * Access the underlying {@see AssetConfigurationBuilder}
	 * @returns The {@see AssetConfigurationBuilder}
	 */
	public asset() {
		return this.#asset;
	}

	/**
	 * Access the underlying {@see AuthenticationConfigurationBuilder}
	 * @returns The {@see AuthenticationConfigurationBuilder}
	 */
	public auth() {
		return this.#auth;
	}

	/**
	 * Finalize the {@see Configuration}
	 * @returns The finalized {@see Configuration} object
	 */
	public build(): Configuration {
		return {
			asset: this.#asset.build(),
			auth: this.#auth.build(),
		};
	}
}

export const config = new ConfigurationBuilder();
