import { PromisedResult } from "../../common/system/result.ts";
import { AssetProvider } from "../../providers/asset.ts";

export class AssetService {
	#assetProvider: AssetProvider;

	constructor(
		assetProvider: AssetProvider,
	) {
		this.#assetProvider = assetProvider;
	}

	fetch(request: Request): PromisedResult<Response, never> {
		// TODO middleware
		return this.#assetProvider.fetch(request);
	}
}
