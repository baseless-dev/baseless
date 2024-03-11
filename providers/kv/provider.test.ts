import type { KVProvider } from "./provider.ts";
import {
	assertEquals,
	assertExists,
	assertRejects,
} from "https://deno.land/std@0.213.0/assert/mod.ts";

export default async function testKVProvider(
	kv: KVProvider,
	t: Deno.TestContext,
): Promise<void> {
	await t.step("put", async () => {
		await kv.put(["posts", "a"], "Title A");
	});

	await t.step("get", async () => {
		const key = await kv.get(["posts", "a"]);
		assertEquals(key.value, "Title A");
	});

	await t.step("list", async () => {
		await Promise.all([
			kv.put(["posts", "b"], "Title B"),
			kv.put(["posts", "b", "comments", "a"], "Comment A on B"),
			kv.put(["posts", "c"], "Title C"),
			kv.put(["posts", "d"], "Title D"),
		]);
		const result1 = await kv.list({ prefix: ["posts"] });
		assertEquals(result1.keys.length, 5);
		assertEquals(result1.keys[0].key, ["posts", "a"]);
		assertEquals(result1.keys[1].key, ["posts", "b"]);
		assertEquals(result1.keys[2].key, ["posts", "b", "comments", "a"]);
		assertEquals(result1.keys[3].key, ["posts", "c"]);
		assertEquals(result1.keys[4].key, ["posts", "d"]);

		const result2 = await kv.list({ prefix: ["posts"], limit: 2 });
		assertEquals(result2.keys.length, 2);
		assertEquals(result2.keys[0].key, ["posts", "a"]);
		assertEquals(result2.keys[1].key, ["posts", "b"]);
		assertExists(result2.next);

		const result3 = await kv.list({ prefix: ["posts"], cursor: result2.next });
		assertEquals(result3.keys.length, 3);
		assertEquals(result3.keys[0].key, ["posts", "b", "comments", "a"]);
		assertEquals(result3.keys[1].key, ["posts", "c"]);
		assertEquals(result3.keys[2].key, ["posts", "d"]);
	});

	await t.step("delete", async () => {
		await kv.delete(["posts", "b"]);
		const result1 = await kv.list({ prefix: ["posts"] });
		assertEquals(result1.keys.length, 4);
		assertEquals(result1.keys[0].key, ["posts", "a"]);
		assertEquals(result1.keys[1].key, ["posts", "b", "comments", "a"]);
		assertEquals(result1.keys[2].key, ["posts", "c"]);
		assertEquals(result1.keys[3].key, ["posts", "d"]);

		await kv.delete(["posts", "z"]);
	});

	await t.step("put with expiration", async () => {
		await kv.put(["expire", "a"], "Title A", { expiration: 10 });
		await new Promise((r) => setTimeout(r, 50));
		await assertRejects(() => kv.get(["expire", "a"]));
	});
}
