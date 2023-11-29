import testAssetProvider from "../asset.test.ts";
import { fromFileUrl } from "https://deno.land/std@0.179.0/path/mod.ts";
import { DenoFSAssetProvider } from "./mod.ts";

Deno.test("DenoFSAssetProvider", async (t) => {
	const ap = new DenoFSAssetProvider(fromFileUrl("./tests"));
	await testAssetProvider(ap, t);
});
