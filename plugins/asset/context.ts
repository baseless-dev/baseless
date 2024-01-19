import type { IAssetService } from "../../common/services/asset.ts";

export interface Context {
	readonly asset: IAssetService;
}
