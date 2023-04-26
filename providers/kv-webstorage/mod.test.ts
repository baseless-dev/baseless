import { WebStorageKVProvider } from "./mod.ts";
import testKVProvider from "../../server/providers/kv.test.ts";

Deno.test("WebStorageKVProvider", async (t) => {
	const kv = new WebStorageKVProvider(
		sessionStorage,
		"baseless-kv-webstorage-test-put",
	);
	await testKVProvider(kv, t);
});
