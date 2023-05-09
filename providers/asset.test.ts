import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { AssetProvider } from "./asset.ts";
import { assertResultOk } from "../common/system/result.ts";

export default async function testAssetProvider(
	ap: AssetProvider,
	t: Deno.TestContext,
) {
	await t.step("fetch", async () => {
		const resp1 = await ap.fetch(new Request("http://test.local/"));
		assertResultOk(resp1, (v): v is Response => v instanceof Response);
		assertEquals(resp1.value.status, 200);
		assertEquals(
			resp1.value.headers.get("Content-Type"),
			"text/html; charset=UTF-8",
		);
		assertEquals(
			await resp1.value.text(),
			"<html><body>This is HTML</body></html>",
		);
		const resp2 = await ap.fetch(new Request("http://test.local/404"));
		assertResultOk(resp2, (v): v is Response => v instanceof Response);
		assertEquals(resp2.value.status, 404);
		const resp3 = await ap.fetch(new Request("http://test.local/text.txt"));
		assertResultOk(resp3, (v): v is Response => v instanceof Response);
		assertEquals(resp3.value.status, 200);
		assertEquals(
			resp3.value.headers.get("Content-Type"),
			"text/plain; charset=UTF-8",
		);
		assertEquals(await resp3.value.text(), "This is a test");
	});
}
