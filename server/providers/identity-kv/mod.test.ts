import { WebStorageKVProvider } from "../kv-webstorage/mod.ts";
import { KVIdentityProvider } from "./mod.ts";
import testIdentityProvider from "../identity.test.ts";

Deno.test("KVIdentityProvider", async (t) => {
	const kv = new WebStorageKVProvider(
		sessionStorage,
		import.meta.url + "KVIdentityProvider",
	);
	const ip = new KVIdentityProvider(kv);
	await testIdentityProvider(ip, t);
});
