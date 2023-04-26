import { AssetProvider } from "../../server/providers/asset.ts";
import { createLogger } from "../../server/logger.ts";

export class WebCacheAssetProvider implements AssetProvider {
	#logger = createLogger("asset-local");
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
		this.#cache.put(request, response.clone());
		return response;
	}
}
