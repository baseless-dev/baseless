import { AssetProvider } from "../providers/asset.ts";

export class AssetService {
	#assetProvider: AssetProvider;

	constructor(
		assetProvider: AssetProvider,
	) {
		this.#assetProvider = assetProvider;
	}

	fetch(request: Request): Promise<Response> {
		// TODO middleware
		return this.#assetProvider.fetch(request);
	}
}
