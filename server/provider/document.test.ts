import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { assert } from "@std/assert/assert";
import { DocumentProvider } from "./document.ts";

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

	await t.step("atomic.set", async () => {
		await provider.atomic()
			.set(
				["users", "john"],
				{
					username: "John",
					age: 25,
				} satisfies User,
			)
			.set(
				["users", "jane"],
				{
					username: "Jane",
					age: 24,
				} satisfies User,
			)
			.set(
				["users", "foo"],
				{
					username: "Bar",
					age: 42,
				} satisfies User,
			)
			.commit();

		await assertRejects(() =>
			provider.atomic()
				.check(["users", "foo"], null)
				.set(["users", "foo"], null)
				.commit()
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

	await t.step("atomic.delete", async () => {
		await provider.atomic()
			.delete(["users", "john"])
			.delete(["users", "unknown"])
			.commit();
		await assertRejects(() => provider.get(["users", "john"]));
	});
}
