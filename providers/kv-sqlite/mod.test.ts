import { SqliteKVProvider } from "./mod.ts";
import testKVProvider from "../../server/providers/kv.test.ts";

Deno.test("SqliteKVProvider", async (t) => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	await testKVProvider(kv, t);
	await kv.close();
});
