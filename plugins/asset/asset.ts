import type { IAssetService } from "../../common/services/asset.ts";
import type { AssetProvider } from "../../providers/asset.ts";

export class AssetService implements IAssetService {
	#assetProvider: AssetProvider;

	constructor(
		assetProvider: AssetProvider,
	) {
		this.#assetProvider = assetProvider;
	}

	fetch(request: Request): Promise<Response> {
		return this.#assetProvider.fetch(request);
	}
}
