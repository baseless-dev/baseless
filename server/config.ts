import { Router, RouterBuilder } from "../common/system/router.ts";
import {
	AssetConfiguration,
	AssetConfigurationBuilder,
} from "./asset/config.ts";
import {
	AuthenticationConfiguration,
	AuthenticationConfigurationBuilder,
} from "./auth/config.ts";
import type { Context } from "./context.ts";

export interface Configuration {
	readonly asset: AssetConfiguration;
	readonly auth: AuthenticationConfiguration;
	readonly functions: Router<[context: Context]>;
}

export class ConfigurationBuilder {
	#asset = new AssetConfigurationBuilder();
	#auth = new AuthenticationConfigurationBuilder();
	#functions = new RouterBuilder<[context: Context]>();

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
