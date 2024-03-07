import type { AssetService } from "./asset.ts";

export interface AssetContext {
	readonly asset: AssetService;
}
