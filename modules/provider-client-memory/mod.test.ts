import { assertEquals, assertRejects } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { MemoryClientProvider } from "./mod.ts";
import { Client } from "https://baseless.dev/x/provider/client.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.3.7/key/generate_key_pair.ts";

Deno.test("provider-client-memory", async (t) => {
	const { privateKey, publicKey } = await generateKeyPair("RS256");

	await t.step("construct", () => {
		new MemoryClientProvider([new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey)]);
	});

	await t.step("getClientById", async () => {
		const provider = new MemoryClientProvider([
			new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey),
		]);
		await assertRejects(() => provider.getClientById("missing"));

		const client = await provider.getClientById("foo");
		assertEquals(client.principal, "Foobar");
	});
});
