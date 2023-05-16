import { Configuration } from "../common/server/config/config.ts";
import { IContext } from "../common/server/context.ts";
import { RouterBuilder } from "../common/system/router.ts";
import { AssetConfigurationBuilder } from "./asset/config.ts";
import { AuthenticationConfigurationBuilder } from "./auth/config.ts";

export class ConfigurationBuilder {
	#asset = new AssetConfigurationBuilder();
	#auth = new AuthenticationConfigurationBuilder();
	#functions = new RouterBuilder<[context: IContext]>();

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
	 * Access the underlying {@see RouterBuilder}
	 * @returns The {@see RouterBuilder}
	 */
	public functions() {
		return this.#functions;
	}

	/**
	 * Finalize the {@see Configuration}
	 * @returns The finalized {@see Configuration} object
	 */
	public build(): Configuration {
		return {
			asset: this.#asset.build(),
			auth: this.#auth.build(),
			functions: this.#functions.build(),
		};
	}
}

export const config = new ConfigurationBuilder();
