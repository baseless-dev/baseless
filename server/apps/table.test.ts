import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { BatchQueryBuilder } from "@baseless/core/query";
import { id } from "@baseless/core/id";
import { ForbiddenError } from "@baseless/core/errors";
import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import createMemoryServer from "../server.test.ts";
import tableApp from "./table.ts";

type UserRow = {
	id: string;
	name: string;
	age?: number;
};

Deno.test("Table application", async (t) => {
	const allowedId = id("id_");
	const hiddenId = id("id_");
	const blockedId = id("id_");
	const q = new BatchQueryBuilder<{ users: UserRow }, { users: UserRow }, {}>([], []);

	using mock = await createMemoryServer({
		app: app()
			.extend(tableApp)
			.table({
				path: "users",
				schema: z.object({ id: z.id("id_"), name: z.string(), age: z.optional(z.number()) }),
				tableSecurity: () => Permission.All,
				rowSecurity: ({ q }) => q.equal(q.ref("users", "id"), q.literal(allowedId)),
			})
			.build(),
		configuration: {},
	});

	await mock.provider.libsql.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NULL)`);
	await mock.provider.table.execute(
		q.insertInto("users")
			.values((q) => ({
				id: q.literal(hiddenId),
				name: q.literal("Hidden User"),
				age: q.literal(7),
			}))
			.toStatement(),
		{},
	);

	await t.step("insert allowed row", async () => {
		await mock.fetch("/table/execute", {
			data: {
				statement: q.insertInto("users")
					.values((q) => ({
						id: q.literal(allowedId),
						name: q.literal("Allowed User"),
						age: q.literal(42),
					}))
					.toStatement(),
				params: {},
			},
			schema: z.object({ result: z.unknown() }),
		});
	});

	await t.step("insert blocked row is forbidden", async () => {
		await assertRejects(
			() =>
				mock.fetch("/table/execute", {
					data: {
						statement: q.insertInto("users")
							.values((q) => ({
								id: q.literal(blockedId),
								name: q.literal("Blocked User"),
								age: q.literal(11),
							}))
							.toStatement(),
						params: {},
					},
				}),
			ForbiddenError,
		);
	});

	await t.step("select only returns row-security matches", async () => {
		const resp = await mock.fetch("/table/execute", {
			data: {
				statement: q.selectFrom("users")
					.select(["users.id", "users.name", "users.age"])
					.toStatement(),
				params: {},
			},
			schema: z.object({
				result: z.array(z.object({ id: z.id("id_"), name: z.string(), age: z.number() })),
			}),
		});

		assertEquals(resp.result, [{ id: allowedId, name: "Allowed User", age: 42 }]);
	});
});
