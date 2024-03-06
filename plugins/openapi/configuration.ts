import type { OpenAPIV3 } from "npm:openapi-types@12.1.3";

type Options = {
	info?: OpenAPIV3.InfoObject;
	path?: string;
	servers?: OpenAPIV3.ServerObject[];
	tags?: string[];
};

export class OpenAPIConfiguration {
	#options?: Options;

	constructor(
		options?: Options,
	) {
		this.#options = options;
	}

	setInfo(info: OpenAPIV3.InfoObject): OpenAPIConfiguration {
		return new OpenAPIConfiguration({
			...this.#options,
			info: { ...info },
		});
	}

	setPath(path: string): OpenAPIConfiguration {
		return new OpenAPIConfiguration({
			...this.#options,
			path,
		});
	}

	setServers(servers: OpenAPIV3.ServerObject[]): OpenAPIConfiguration {
		return new OpenAPIConfiguration({
			...this.#options,
			servers: [...servers],
		});
	}

	setTags(tags: string[]): OpenAPIConfiguration {
		return new OpenAPIConfiguration({
			...this.#options,
			tags: { ...tags },
		});
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		return Object.freeze({
			info: this.#options?.info ?? {
				title: "OpenAPI Reference",
				description: "The OpenAPI documentation for this API",
				version: "0.0.0-0",
			},
			path: this.#options?.path ?? "/openapi.json",
			servers: this.#options?.servers,
			tags: this.#options?.tags,
		});
	}
}
