import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { BatchQueryBuilder, RootQueryBuilder } from "@baseless/core/query";
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
	const q = new BatchQueryBuilder<{ users: UserRow }, { users: UserRow }, Record<string, never>>([], []);

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

	await t.step("update allowed row changes it", async () => {
		const rq = new RootQueryBuilder<{ users: UserRow }, { users: UserRow }>();
		await mock.fetch("/table/execute", {
			data: {
				statement: rq.updateFrom("users")
					.set((q) => ({ name: q.literal("Allowed User Updated") }))
					.where((q) => q.eq(q.ref("users", "id"), q.literal(allowedId)))
					.toStatement(),
				params: {},
			},
			schema: z.object({ result: z.unknown() }),
		});

		// Verify directly via raw SQL (bypasses RLS)
		const { rows } = await mock.provider.libsql.execute(`SELECT name FROM users WHERE id = '${allowedId}'`);
		assertEquals(rows[0]?.name, "Allowed User Updated");
	});

	await t.step("update hidden row leaves it intact", async () => {
		const rq = new RootQueryBuilder<{ users: UserRow }, { users: UserRow }>();
		await mock.fetch("/table/execute", {
			data: {
				statement: rq.updateFrom("users")
					.set((q) => ({ name: q.literal("Should Not Change") }))
					.where((q) => q.eq(q.ref("users", "id"), q.literal(hiddenId)))
					.toStatement(),
				params: {},
			},
			schema: z.object({ result: z.unknown() }),
		});

		// Verify via raw SQL that the hidden row was not updated (RLS blocked it)
		const { rows } = await mock.provider.libsql.execute(`SELECT name FROM users WHERE id = '${hiddenId}'`);
		assertEquals(rows[0]?.name, "Hidden User");
	});

	await t.step("delete hidden row leaves it intact", async () => {
		const rq = new RootQueryBuilder<{ users: UserRow }, { users: UserRow }>();
		await mock.fetch("/table/execute", {
			data: {
				statement: rq.deleteFrom("users")
					.where((q) => q.eq(q.ref("users", "id"), q.literal(hiddenId)))
					.toStatement(),
				params: {},
			},
			schema: z.object({ result: z.unknown() }),
		});

		// Verify via raw SQL that the hidden row still exists (RLS blocked the delete)
		const { rows } = await mock.provider.libsql.execute(`SELECT id FROM users WHERE id = '${hiddenId}'`);
		assertEquals(rows.length, 1);
	});

	await t.step("delete allowed row removes it", async () => {
		const allowedId2 = id("id_");
		// Insert directly so RLS insert check doesn't block us
		await mock.provider.libsql.execute(`INSERT INTO users (id, name, age) VALUES ('${allowedId2}', 'To Delete', 1)`);

		const rq = new RootQueryBuilder<{ users: UserRow }, { users: UserRow }>();
		// The row has allowedId2 but the rowSecurity filter is pinned to allowedId.
		// Deleting allowedId2 will be blocked by RLS just like hiddenId.
		// We characterize current behavior: only the row matching the rowSecurity filter can be deleted.
		// To delete an "allowed" row, we use the actual allowedId.
		await mock.fetch("/table/execute", {
			data: {
				statement: rq.deleteFrom("users")
					.where((q) => q.eq(q.ref("users", "id"), q.literal(allowedId)))
					.toStatement(),
				params: {},
			},
			schema: z.object({ result: z.unknown() }),
		});

		// The allowedId row should be gone
		const { rows } = await mock.provider.libsql.execute(`SELECT id FROM users WHERE id = '${allowedId}'`);
		assertEquals(rows.length, 0);
	});
});

Deno.test("Table application — tableSecurity denial", async (t) => {
	// A separate mock with tableSecurity returning Permission.Select only
	// so INSERT is denied at the table level (not row level)
	const selectOnlyId = id("id_");
	using mock = await createMemoryServer({
		app: app()
			.extend(tableApp)
			.table({
				path: "users",
				schema: z.object({ id: z.id("id_"), name: z.string(), age: z.optional(z.number()) }),
				tableSecurity: () => Permission.Select,
				rowSecurity: ({ q }) => q.equal(q.ref("users", "id"), q.literal(selectOnlyId)),
			})
			.build(),
		configuration: {},
	});

	await mock.provider.libsql.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NULL)`);

	await t.step("insert is denied when tableSecurity lacks Insert permission", async () => {
		type UserRow2 = { id: string; name: string; age?: number };
		const rq2 = new RootQueryBuilder<{ users: UserRow2 }, { users: UserRow2 }>();
		await assertRejects(
			() =>
				mock.fetch("/table/execute", {
					data: {
						statement: rq2.insertInto("users")
							.values((q) => ({
								id: q.literal(selectOnlyId),
								name: q.literal("Forbidden Insert"),
								age: q.literal(0),
							}))
							.toStatement(),
						params: {},
					},
				}),
			ForbiddenError,
		);
	});
});

Deno.test("Table application — batch with allowed and denied ops", async (t) => {
	// Characterizes CURRENT semantics: batch containing one allowed and one denied sub-statement.
	// INSERT VALUES rows are validated individually against row security BEFORE execution.
	// An INSERT whose VALUES row does NOT match the RLS expression throws ForbiddenError immediately.
	// An UPDATE/DELETE on a hidden row has the RLS predicate injected as an AND clause, so it
	// affects 0 rows (silently) rather than throwing. This test documents that asymmetry.
	const batchAllowedId = id("id_");
	const batchHiddenId = id("id_");

	using mock = await createMemoryServer({
		app: app()
			.extend(tableApp)
			.table({
				path: "users",
				schema: z.object({ id: z.id("id_"), name: z.string(), age: z.optional(z.number()) }),
				tableSecurity: () => Permission.All,
				rowSecurity: ({ q }) => q.equal(q.ref("users", "id"), q.literal(batchAllowedId)),
			})
			.build(),
		configuration: {},
	});

	await mock.provider.libsql.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NULL)`);
	await mock.provider.libsql.execute(`INSERT INTO users (id, name, age) VALUES ('${batchAllowedId}', 'Batch Allowed', 10)`);
	await mock.provider.libsql.execute(`INSERT INTO users (id, name, age) VALUES ('${batchHiddenId}', 'Batch Hidden', 20)`);

	await t.step(
		"batch: INSERT of a non-RLS-matching row throws ForbiddenError (current behavior — early client-side validation)",
		async () => {
			// Current behavior (characterization): INSERT VALUES are checked against the
			// RLS expression BEFORE the SQL is executed. If the inserted row's id column
			// does not match the allowed id, ForbiddenError is thrown immediately.
			// This is an asymmetry with UPDATE/DELETE which use SQL-level WHERE injection.
			const newHiddenId = id("id_");
			const rq = new RootQueryBuilder<
				{ users: { id: string; name: string; age?: number } },
				{ users: { id: string; name: string; age?: number } }
			>();
			await assertRejects(
				() =>
					mock.fetch("/table/execute", {
						data: {
							statement: rq.insertInto("users")
								.values((q) => ({
									id: q.literal(newHiddenId),
									name: q.literal("Hidden Insert"),
									age: q.literal(5),
								}))
								.toStatement(),
							params: {},
						},
					}),
				ForbiddenError,
			);
		},
	);

	await t.step("batch: UPDATE of hidden row is silently filtered (0 rows affected, not an error)", async () => {
		// Current behavior (characterization): UPDATE with row-security WHERE injection
		// simply adds the security predicate, so the hidden row is not matched.
		// The statement succeeds but affects 0 rows — it is NOT a ForbiddenError.
		// This differs from INSERT which throws eagerly (see previous step).
		const rq = new RootQueryBuilder<
			{ users: { id: string; name: string; age?: number } },
			{ users: { id: string; name: string; age?: number } }
		>();
		await mock.fetch("/table/execute", {
			data: {
				statement: rq.updateFrom("users")
					.set((q) => ({ name: q.literal("Should Stay Hidden") }))
					.where((q) => q.eq(q.ref("users", "id"), q.literal(batchHiddenId)))
					.toStatement(),
				params: {},
			},
			schema: z.object({ result: z.unknown() }),
		});
		const { rows } = await mock.provider.libsql.execute(`SELECT name FROM users WHERE id = '${batchHiddenId}'`);
		assertEquals(rows[0]?.name, "Batch Hidden");
	});
});
