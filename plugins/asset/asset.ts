import type { AssetProvider } from "../../providers/asset/provider.ts";

export class AssetService {
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
