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
			const results = await provider.list({ prefix: ["users"] });
			assertEquals(results.keys.length, 3);
			assertEquals(results.cursor, undefined);
			assertEquals(results.keys, [
				["users", "foo"],
				["users", "jane"],
				["users", "john"],
			]);
		}
		{
			const results1 = await provider.list({ prefix: ["users"], limit: 1 });
			assertEquals(results1.keys.length, 1);
			assert(!!results1.cursor);
			assertEquals(results1.keys, [
				["users", "foo"],
			]);
			const results2 = await provider.list({
				prefix: ["users"],
				limit: 1,
				cursor: results1.cursor,
			});
			assertEquals(results2.keys.length, 1);
			assert(!!results2.cursor);
			assertEquals(results2.keys, [
				["users", "jane"],
			]);
			const results3 = await provider.list({
				prefix: ["users"],
				limit: 1,
				cursor: results2.cursor,
			});
			assertEquals(results3.keys.length, 1);
			assert(!!results3.cursor);
			assertEquals(results3.keys, [
				["users", "john"],
			]);
			const results4 = await provider.list({
				prefix: ["users"],
				limit: 1,
				cursor: results3.cursor,
			});
			assertEquals(results4.keys.length, 0);
			assertEquals(results4.cursor, undefined);
			assertEquals(results4.keys, []);
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
