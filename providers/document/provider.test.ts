import type { DocumentProvider } from "./provider.ts";
import {
	assert,
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.213.0/assert/mod.ts";

export default async function testDocumentProvider(
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

	await t.step("patch", async () => {
		await provider.patch(
			["users", "foo"],
			{
				age: 21,
			} satisfies Partial<User>,
		);
		const { data } = await provider.get(["users", "foo"]);
		assertEquals(data, { username: "Barbar", age: 21 });
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
