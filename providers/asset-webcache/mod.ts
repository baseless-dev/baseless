import { createLogger } from "../../common/system/logger.ts";
import { PromisedResult, isResultOk, ok } from "../../common/system/result.ts";
import { AssetProvider } from "../asset.ts";

export class WebCacheAssetProvider implements AssetProvider {
	#logger = createLogger("asset-local");
	#cache: Cache;
	#fallbackAssetProvider: AssetProvider;

	constructor(cache: Cache, fallbackAssetProvider: AssetProvider) {
		this.#cache = cache;
		this.#fallbackAssetProvider = fallbackAssetProvider;
	}

	async fetch(request: Request): PromisedResult<Response, never> {
		const url = new URL(request.url);
		try {
			const response = await this.#cache.match(request);
			if (response) {
				return ok(response);
			}
			const fallbackResponse = await this.#fallbackAssetProvider.fetch(request);
			if (isResultOk(fallbackResponse, (v): v is Response => v instanceof Response)) {
				this.#cache.put(request, fallbackResponse.value.clone());
				return fallbackResponse;
			}
		} catch (inner) {
			this.#logger.debug(`Could not process ${url.pathname}, got ${inner}.`);
		}
		return ok(new Response(null, { status: 404 }));
	}
}
