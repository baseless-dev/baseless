import testAssetProvider from "../provider.test.ts";
import { fromFileUrl } from "https://deno.land/std@0.213.0/path/mod.ts";
import { DenoFSAssetProvider } from "./mod.ts";

Deno.test("DenoFSAssetProvider", async (t) => {
	const ap = new DenoFSAssetProvider(
		fromFileUrl(await import.meta.resolve("./tests")),
	);
	await testAssetProvider(ap, t);
});
