import { assertEquals } from "jsr:@std/assert@1.0.0/equals";
import { assertExists } from "jsr:@std/assert@1.0.0/exists";
import { assertRejects } from "jsr:@std/assert@1.0.0/rejects";
import { DocumentProvider, KVProvider } from "./provider.ts";
import { assert } from "jsr:@std/assert@1.0.0/assert";

export async function testKVProvider(
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

export async function testDocumentProvider(
	provider: DocumentProvider,
	t: Deno.TestContext,
): Promise<void> {
	interface User {
		username: string;
		age: number;
	}
	function isUser(value: unknown): value is User {
		return typeof value === "object" && value !== null && "username" in value &&
			"age" in value;
	}

	await t.step("create", async () => {
		await provider.create(
			["users", "john"],
			{
				username: "John",
				age: 25,
			} satisfies User,
		);
		await provider.create(
			["users", "jane"],
			{
				username: "Jane",
				age: 24,
			} satisfies User,
		);
		await provider.create(
			["users", "foo"],
			{
				username: "Bar",
				age: 42,
			} satisfies User,
		);
		await assertRejects(() =>
			provider.create(
				["users", "john"],
				{ username: "John2", age: 1 } satisfies User,
			)
		);
	});

	await t.step("get", async () => {
		const user = await provider.get(["users", "john"]);
		assert(isUser(user.data));
		assertEquals(user.data.username, "John");
		assertEquals(user.data.age, 25);
	});

	await t.step("getMany", async () => {
		const users = await provider.getMany([["users", "john"], [
			"users",
			"jane",
		]]);
		assertEquals(users.length, 2);
		assert(isUser(users[0].data));
		assertEquals(users[0].data.username, "John");
		assert(isUser(users[1].data));
		assertEquals(users[1].data.username, "Jane");
	});

	await t.step("list", async () => {
		{
			const results = await Array.fromAsync(
				provider.list({ prefix: ["users"] }),
			);
			assertEquals(results.length, 3);
			assertEquals(results[0].document.key, ["users", "foo"]);
			assertEquals(results[1].document.key, ["users", "jane"]);
			assertEquals(results[2].document.key, ["users", "john"]);
		}
		{
			const results1 = await Array.fromAsync(
				provider.list({ prefix: ["users"], limit: 1 }),
			);
			assertEquals(results1.length, 1);
			assertEquals(results1[0].document.key, ["users", "foo"]);
			const results2 = await Array.fromAsync(provider.list({
				prefix: ["users"],
				limit: 1,
				cursor: results1[0].cursor,
			}));
			assertEquals(results2.length, 1);
			assertEquals(results2[0].document.key, ["users", "jane"]);
			const results3 = await Array.fromAsync(provider.list({
				prefix: ["users"],
				limit: 1,
				cursor: results2[0].cursor,
			}));
			assertEquals(results3.length, 1);
			assertEquals(results3[0].document.key, ["users", "john"]);
			const results4 = await Array.fromAsync(provider.list({
				prefix: ["users"],
				limit: 1,
				cursor: results3[0].cursor,
			}));
			assertEquals(results4.length, 0);
		}
	});

	await t.step("update", async () => {
		await provider.update(
			["users", "foo"],
			{
				username: "Barbar",
				age: 18,
			} satisfies User,
		);
		const { data } = await provider.get(["users", "foo"]);
		assertEquals(data, { username: "Barbar", age: 18 });
	});

	await t.step("delete", async () => {
		await provider.delete(["users", "john"]);
		await provider.delete(["users", "unknown"]);
		await assertRejects(() => provider.get(["users", "john"]));
	});

	await t.step("deleteMany", async () => {
		await provider.deleteMany([["users", "jane"], ["users", "foo"]]);
		await assertRejects(() => provider.get(["users", "jane"]));
		await assertRejects(() => provider.get(["users", "foo"]));
	});

	await t.step("atomic", async () => {
		const result = await provider.atomic()
			.notExists(["users", "bar"])
			.set(["users", "bar"], { username: "Barrr", age: 28 })
			.commit();
		assertEquals(result.ok, true);
	});
}
