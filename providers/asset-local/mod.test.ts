import testAssetProvider from "../asset.test.ts";
import { LocalAssetProvider } from "./mod.ts";

Deno.test("LocalAssetProvider", async (t) => {
	const ap = new LocalAssetProvider(import.meta.resolve("./tests"));
	await testAssetProvider(ap, t);
});
