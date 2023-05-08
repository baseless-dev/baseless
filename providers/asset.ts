import { PromisedResult } from "../common/system/result.ts";

export interface AssetProvider {
	fetch(request: Request): PromisedResult<Response, never>;
}
