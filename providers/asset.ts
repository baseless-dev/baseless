import { Result } from "../common/system/result.ts";

export interface AssetProvider {
	fetch(request: Request): Promise<Result<Response, never>>;
}
