import { createLogger } from "../../../lib/logger.ts";
import type { AssetProvider } from "../provider.ts";

export class WebCacheAssetProvider implements AssetProvider {
	#logger = createLogger("asset-webcache");
	#cache: Cache;
	#fallbackAssetProvider: AssetProvider;

	constructor(cache: Cache, fallbackAssetProvider: AssetProvider) {
		this.#cache = cache;
		this.#fallbackAssetProvider = fallbackAssetProvider;
	}

	async fetch(request: Request): Promise<Response> {
		let response = await this.#cache.match(request);
		if (response) {
			return response;
		}
		response = await this.#fallbackAssetProvider.fetch(request);
		await this.#cache.put(request, response.clone());
		return response;
	}
}
