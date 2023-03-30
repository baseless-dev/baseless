import { AuthBuilder, AuthConfiguration } from "./auth/config.ts";

export interface Configuration {
	readonly auth: AuthConfiguration;
}

export class ConfigurationBuilder {
	#auth = new AuthBuilder();

	/**
	 * Access the underlying {@see AuthBuilder}
	 * @returns The {@see AuthBuilder}
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
			auth: this.#auth.build(),
		};
	}
}

export const config = new ConfigurationBuilder();
