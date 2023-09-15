import testAssetProvider from "../asset.test.ts";
import { DenoFSAssetProvider } from "./mod.ts";

Deno.test("DenoFSAssetProvider", async (t) => {
	const ap = new DenoFSAssetProvider(import.meta.resolve("./tests"));
	await testAssetProvider(ap, t);
});
