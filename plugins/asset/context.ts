import type { AssetService } from "./asset.ts";

export interface Context {
	readonly asset: AssetService;
}
