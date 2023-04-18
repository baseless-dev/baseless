import { LocalAssetProvider } from "../asset-local/mod.ts";
import { WebCacheAssetProvider } from "./mod.ts";
import testAssetProvider from "../asset.test.ts";

Deno.test("WebCacheAssetProvider", async (t) => {
	const lap = new LocalAssetProvider(
		import.meta.resolve("../asset-local/tests"),
	);
	await caches.delete("baseless-asset-cache-test");
	const ap = new WebCacheAssetProvider("baseless-asset-cache-test", lap);
	await testAssetProvider(ap, t);
});
