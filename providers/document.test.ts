import { DocumentProvider } from "./document.ts";
import {
	assert,
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";

export default async function testDocumentProvider(
	provider: DocumentProvider,
	t: Deno.TestContext,
): Promise<void> {
	interface User {
		username: string;
		age: number;
	}

	await t.step("create", async () => {
		await provider.create<User>(["users", "john"], {
			username: "John",
			age: 25,
		});
		await provider.create<User>(["users", "jane"], {
			username: "Jane",
			age: 24,
		});
		await provider.create<User>(["users", "foo"], {
			username: "Bar",
			age: 42,
		});
		assertRejects(() =>
			provider.create<User>(["users", "john"], { username: "John2", age: 1 })
		);
	});

	await t.step("get", async () => {
		const user = await provider.get<User>(["users", "john"]);
		assertEquals(user.data.username, "John");
		assertEquals(user.data.age, 25);
	});

	await t.step("getMany", async () => {
		const users = await provider.getMany<User>([["users", "john"], [
			"users",
			"jane",
		]]);
		assertEquals(users.length, 2);
		assertEquals(users[0].data.username, "John");
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
		await provider.update<User>(["users", "foo"], {
			username: "Barbar",
			age: 18,
		});
		const { data } = await provider.get<User>(["users", "foo"]);
		assertEquals(data, { username: "Barbar", age: 18 });
	});

	await t.step("patch", async () => {
		await provider.patch<User>(["users", "foo"], {
			age: 21,
		});
		const { data } = await provider.get<User>(["users", "foo"]);
		assertEquals(data, { username: "Barbar", age: 21 });
	});

	await t.step("delete", async () => {
		await provider.delete(["users", "john"]);
		await provider.delete(["users", "unknown"]);
		assertRejects(() => provider.get<User>(["users", "john"]));
	});

	await t.step("deleteMany", async () => {
		await provider.deleteMany([["users", "jane"], ["users", "foo"]]);
		assertRejects(() => provider.get<User>(["users", "jane"]));
		assertRejects(() => provider.get<User>(["users", "foo"]));
	});

	await t.step("atomic", async () => {
		const atomic = provider.atomic()
			.notExists(["users", "bar"])
			.set<User>(["users", "bar"], { username: "Barrr", age: 28 });
		const result = await provider.commit(atomic);
		assertEquals(result.ok, true);
	});
}