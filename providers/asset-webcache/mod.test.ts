import { LocalAssetProvider } from "../asset-local/mod.ts";
import { WebCacheAssetProvider } from "./mod.ts";
import testAssetProvider from "../../server/providers/asset.test.ts";

Deno.test("WebCacheAssetProvider", async (t) => {
	const lap = new LocalAssetProvider(
		import.meta.resolve("../asset-local/tests"),
	);
	await caches.delete("baseless-asset-cache-test");
	const ap = new WebCacheAssetProvider(
		await caches.open("baseless-asset-cache-test"),
		lap,
	);
	await testAssetProvider(ap, t);
});
