import testKVProvider from "../provider.test.ts";
import { WebStorageKVProvider } from "./mod.ts";

Deno.test("WebStorageKVProvider", async (t) => {
	const kv = new WebStorageKVProvider(
		sessionStorage,
		"baseless-kv-webstorage-test-put",
	);
	await testKVProvider(kv, t);
});
