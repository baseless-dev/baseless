import { DenoFSAssetProvider } from "../asset-denofs/mod.ts";
import { fromFileUrl } from "../../deps.test.ts";
import testAssetProvider from "../asset.test.ts";
import { WebCacheAssetProvider } from "./mod.ts";

Deno.test("WebCacheAssetProvider", async (t) => {
	const lap = new DenoFSAssetProvider(
		fromFileUrl(await import.meta.resolve("../asset-denofs/tests")),
	);
	await caches.delete("baseless-asset-cache-test");
	const ap = new WebCacheAssetProvider(
		await caches.open("baseless-asset-cache-test"),
		lap,
	);
	await testAssetProvider(ap, t);
});
