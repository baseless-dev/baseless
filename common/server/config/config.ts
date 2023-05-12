import { AssetConfiguration } from "./asset.ts";
import { AuthenticationConfiguration } from "./auth.ts";
import { Router } from "../../system/router.ts";
import { Context } from "../context.ts";

export interface Configuration {
	readonly asset: AssetConfiguration;
	readonly auth: AuthenticationConfiguration;
	readonly functions: Router<[context: Context]>;
}
