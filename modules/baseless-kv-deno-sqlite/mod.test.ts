import { assertEquals, assertExists } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { KVDenoDBProvider } from "./mod.ts";

Deno.test("open & close", async () => {
	const kv = new KVDenoDBProvider(":memory:");
	await kv.open();
	await kv.close();
});
Deno.test("put & get", async () => {
	const kv = new KVDenoDBProvider(":memory:");
	await kv.open();
	await kv.put("/posts/a", "Title A");
	const key = await kv.get("/posts/a");
	assertEquals(key.value, "Title A");
	await kv.close();
});
Deno.test("list", async () => {
	const kv = new KVDenoDBProvider(":memory:");
	await kv.open();
	await Promise.all([
		kv.put("/posts/a", "Title A"),
		kv.put("/posts/b", "Title B"),
		kv.put("/posts/b/comments/a", "Comment A on B"),
		kv.put("/posts/c", "Title C"),
		kv.put("/posts/d", "Title D"),
	]);
	const result1 = await kv.list({ prefix: "/posts" });
	assertEquals(result1.keys.length, 5);
	assertEquals(result1.keys[0].key, "/posts/a");
	assertEquals(result1.keys[0].value, "Title A");
	assertEquals(result1.keys[1].key, "/posts/b");
	assertEquals(result1.keys[1].value, "Title B");
	assertEquals(result1.keys[2].key, "/posts/b/comments/a");
	assertEquals(result1.keys[2].value, "Comment A on B");
	assertEquals(result1.keys[3].key, "/posts/c");
	assertEquals(result1.keys[3].value, "Title C");
	assertEquals(result1.keys[4].key, "/posts/d");
	assertEquals(result1.keys[4].value, "Title D");

	const result2 = await kv.list({ prefix: "/posts", limit: 2 });
	assertEquals(result2.keys.length, 2);
	assertEquals(result2.keys[0].key, "/posts/a");
	assertEquals(result2.keys[0].value, "Title A");
	assertEquals(result2.keys[1].key, "/posts/b");
	assertEquals(result2.keys[1].value, "Title B");
	assertExists(result2.next);

	const result3 = await kv.list({ prefix: "/posts", cursor: result2.next });
	assertEquals(result3.keys.length, 3);
	assertEquals(result3.keys[0].key, "/posts/b/comments/a");
	assertEquals(result3.keys[0].value, "Comment A on B");
	assertEquals(result3.keys[1].key, "/posts/c");
	assertEquals(result3.keys[1].value, "Title C");
	assertEquals(result3.keys[2].key, "/posts/d");
	assertEquals(result3.keys[2].value, "Title D");

	await kv.close();
});
Deno.test("delete", async () => {
	const kv = new KVDenoDBProvider(":memory:");
	await kv.open();
	await Promise.all([
		kv.put("/posts/a", "Title A"),
		kv.put("/posts/b", "Title B"),
		kv.put("/posts/c", "Title C"),
		kv.put("/posts/d", "Title D"),
	]);
	await kv.delete("/posts/b");
	const result1 = await kv.list({ prefix: "/posts" });
	assertEquals(result1.keys.length, 3);
	assertEquals(result1.keys[0].key, "/posts/a");
	assertEquals(result1.keys[0].value, "Title A");
	assertEquals(result1.keys[1].key, "/posts/c");
	assertEquals(result1.keys[1].value, "Title C");
	assertEquals(result1.keys[2].key, "/posts/d");
	assertEquals(result1.keys[2].value, "Title D");

	await kv.delete("/posts/z");

	const result2 = await kv.list({ prefix: "/posts" });
	assertEquals(result2.keys.length, 3);
	assertEquals(result2.keys[0].key, "/posts/a");
	assertEquals(result2.keys[0].value, "Title A");
	assertEquals(result2.keys[1].key, "/posts/c");
	assertEquals(result2.keys[1].value, "Title C");
	assertEquals(result2.keys[2].key, "/posts/d");
	assertEquals(result2.keys[2].value, "Title D");

	await kv.close();
});
