import { DenoFSAssetProvider } from "../deno-fs/mod.ts";
import { fromFileUrl } from "https://deno.land/std@0.213.0/path/mod.ts";
import testAssetProvider from "../provider.test.ts";
import { WebCacheAssetProvider } from "./mod.ts";

Deno.test("WebCacheAssetProvider", async (t) => {
	const lap = new DenoFSAssetProvider(
		fromFileUrl(await import.meta.resolve("../deno-fs/tests")),
	);
	await caches.delete("baseless-asset-cache-test");
	const ap = new WebCacheAssetProvider(
		await caches.open("baseless-asset-cache-test"),
		lap,
	);
	await testAssetProvider(ap, t);
});
