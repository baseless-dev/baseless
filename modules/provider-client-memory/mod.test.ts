import { assertEquals, assertRejects } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { MemoryClientProvider } from "./mod.ts";
import { Client } from "https://baseless.dev/x/provider/client.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.3.7/key/generate_key_pair.ts";

Deno.test("construct", async () => {
	const { privateKey, publicKey } = await generateKeyPair("RS256");
	new MemoryClientProvider([new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey)]);
});

Deno.test("getClientById", async () => {
	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const provider = new MemoryClientProvider([
		new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey),
	]);
	await assertRejects(() => provider.getClientById("missing"));

	const client = await provider.getClientById("foo");
	assertEquals(client.principal, "Foobar");
});
