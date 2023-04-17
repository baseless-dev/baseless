import { LocalAssetProvider } from "../asset-local/mod.ts";
import { CacheAssetProvider } from "./mod.ts";
import testAssetProvider from "../asset.test.ts";

Deno.test("CacheAssetProvider", async (t) => {
	const lap = new LocalAssetProvider(import.meta.resolve("../asset-local/tests"));
	await caches.delete("baseless-asset-cache-test");
	const ap = new CacheAssetProvider("baseless-asset-cache-test", lap);
	await testAssetProvider(ap, t);
});
