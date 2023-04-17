import { KVProvider } from "./kv.ts";
import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { AssetProvider } from "./asset.ts";

export default async function testAssetProvider(
	ap: AssetProvider,
	t: Deno.TestContext,
) {
	await t.step("fetch", async () => {
		const resp1 = await ap.fetch(new Request("http://test.local/"));
		assertEquals(resp1.status, 200);
		assertEquals(
			resp1.headers.get("Content-Type"),
			"text/html; charset=UTF-8",
		);
		assertEquals(await resp1.text(), "<html><body>This is HTML</body></html>");
		const resp2 = await ap.fetch(new Request("http://test.local/404"));
		assertEquals(resp2.status, 404);
		const resp3 = await ap.fetch(new Request("http://test.local/text.txt"));
		assertEquals(resp3.status, 200);
		assertEquals(
			resp3.headers.get("Content-Type"),
			"text/plain; charset=UTF-8",
		);
		assertEquals(await resp3.text(), "This is a test");
	});
}
