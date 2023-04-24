import { AssetProvider } from "../asset.ts";
import { createLogger } from "../../logger.ts";

export class WebCacheAssetProvider implements AssetProvider {
	#logger = createLogger("asset-local");
	#cacheName: string;
	#cache?: Cache;
	#fallbackAssetProvider: AssetProvider;

	constructor(cacheName: string, fallbackAssetProvider: AssetProvider) {
		this.#cacheName = cacheName;
		this.#fallbackAssetProvider = fallbackAssetProvider;
	}

	async #openCache(): Promise<Cache> {
		if (!this.#cache) {
			this.#cache = await caches.open(this.#cacheName);
		}
		return this.#cache;
	}

	async fetch(request: Request): Promise<Response> {
		const cache = await this.#openCache();
		let response = await cache.match(request);
		if (response) {
			return response;
		}
		response = await this.#fallbackAssetProvider.fetch(request);
		cache.put(request, response.clone());
		return response;
	}
}
