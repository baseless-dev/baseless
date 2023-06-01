import testAssetProvider from "../asset.test.ts";
import { MemoryAssetProvider } from "./mod.ts";

Deno.test("MemoryAssetProvider", async (t) => {
	const ap = new MemoryAssetProvider([
		["/index.html", {
			body: "<html><body>This is HTML</body></html>",
			contentType: "text/html; charset=UTF-8",
		}],
		["/text.txt", {
			body: "This is a test",
			contentType: "text/plain; charset=UTF-8",
		}],
	]);
	await testAssetProvider(ap, t);
});
