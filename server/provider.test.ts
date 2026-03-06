import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { assertExists } from "@std/assert/exists";
import { assert } from "@std/assert/assert";
import { assertFalse } from "@std/assert/false";
import { DocumentProvider, KVProvider, QueueProvider, RateLimiterProvider, StorageProvider, TableProvider } from "./provider.ts";
import { StorageObjectNotFoundError } from "@baseless/core/errors";
import { BatchableStatementBuilder } from "@baseless/core/query";
import type { TStatement } from "@baseless/core/query";

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
				"users/john",
				{
					username: "John",
					age: 25,
				} satisfies User,
			)
			.set(
				"users/jane",
				{
					username: "Jane",
					age: 24,
				} satisfies User,
			)
			.set(
				"users/foo",
				{
					username: "Bar",
					age: 42,
				} satisfies User,
			)
			.commit();

		await assertRejects(() =>
			provider.atomic()
				.check("users/foo", null)
				.set("users/foo", null)
				.commit()
		);
	});

	await t.step("get", async () => {
		const user = await provider.get("users/john");
		assert(isUser(user.data));
		assertEquals(user.data.username, "John");
		assertEquals(user.data.age, 25);
	});

	await t.step("getMany", async () => {
		const users = await provider.getMany([
			"users/john",
			"users/jane",
		]);
		assertEquals(users.length, 2);
		assert(isUser(users[0].data));
		assertEquals(users[0].data.username, "John");
		assert(isUser(users[1].data));
		assertEquals(users[1].data.username, "Jane");
	});

	await t.step("list", async () => {
		{
			const results = await Array.fromAsync(
				provider.list({ prefix: "users" }),
			);
			assertEquals(results.length, 3);
			assertEquals(results[0].document.key, "users/foo");
			assertEquals(results[1].document.key, "users/jane");
			assertEquals(results[2].document.key, "users/john");
		}
		{
			const results1 = await Array.fromAsync(
				provider.list({ prefix: "users", limit: 1 }),
			);
			assertEquals(results1.length, 1);
			assertEquals(results1[0].document.key, "users/foo");
			const results2 = await Array.fromAsync(provider.list({
				prefix: "users",
				limit: 1,
				cursor: results1[0].cursor,
			}));
			assertEquals(results2.length, 1);
			assertEquals(results2[0].document.key, "users/jane");
			const results3 = await Array.fromAsync(provider.list({
				prefix: "users",
				limit: 1,
				cursor: results2[0].cursor,
			}));
			assertEquals(results3.length, 1);
			assertEquals(results3[0].document.key, "users/john");
			const results4 = await Array.fromAsync(provider.list({
				prefix: "users",
				limit: 1,
				cursor: results3[0].cursor,
			}));
			assertEquals(results4.length, 0);
		}
	});

	await t.step("atomic.delete", async () => {
		await provider.atomic()
			.delete("users/john")
			.delete("users/unknown")
			.commit();
		await assertRejects(() => provider.get("users/john"));
	});
}

export async function testKVProvider(
	kv: KVProvider,
	t: Deno.TestContext,
): Promise<void> {
	await t.step("put", async () => {
		await kv.put("posts/a", "Title A");
	});

	await t.step("get", async () => {
		const key = await kv.get("posts/a");
		assertEquals(key.value, "Title A");
	});

	await t.step("list", async () => {
		await Promise.all([
			kv.put("posts/b", "Title B"),
			kv.put("posts/b/comments/a", "Comment A on B"),
			kv.put("posts/c", "Title C"),
			kv.put("posts/d", "Title D"),
		]);
		const result1 = await kv.list({ prefix: "posts" });
		assertEquals(result1.keys.length, 5);
		assertEquals(result1.keys[0].key, "posts/a");
		assertEquals(result1.keys[1].key, "posts/b");
		assertEquals(result1.keys[2].key, "posts/b/comments/a");
		assertEquals(result1.keys[3].key, "posts/c");
		assertEquals(result1.keys[4].key, "posts/d");

		const result2 = await kv.list({ prefix: "posts", limit: 2 });
		assertEquals(result2.keys.length, 2);
		assertEquals(result2.keys[0].key, "posts/a");
		assertEquals(result2.keys[1].key, "posts/b");
		assertExists(result2.next);

		const result3 = await kv.list({ prefix: "posts", cursor: result2.next });
		assertEquals(result3.keys.length, 3);
		assertEquals(result3.keys[0].key, "posts/b/comments/a");
		assertEquals(result3.keys[1].key, "posts/c");
		assertEquals(result3.keys[2].key, "posts/d");
	});

	await t.step("delete", async () => {
		await kv.delete("posts/b");
		const result1 = await kv.list({ prefix: "posts" });
		assertEquals(result1.keys.length, 4);
		assertEquals(result1.keys[0].key, "posts/a");
		assertEquals(result1.keys[1].key, "posts/b/comments/a");
		assertEquals(result1.keys[2].key, "posts/c");
		assertEquals(result1.keys[3].key, "posts/d");

		await kv.delete("posts/z");
	});

	await t.step("put with expiration", async () => {
		await kv.put("expire/a", "Title A", { expiration: 10 });
		await new Promise((r) => setTimeout(r, 50));
		await assertRejects(() => kv.get("expire/a"));
	});
}

export async function testQueueProvider(
	queue: QueueProvider,
	t: Deno.TestContext,
): Promise<void> {
	await t.step("enqueue", async () => {
		await queue.enqueue({ type: "topic_publish", key: "a", payload: "A" });
		await queue.enqueue({ type: "topic_publish", key: "b", payload: "B" });
		await queue.enqueue({ type: "topic_publish", key: "c", payload: "C" });
	});

	await t.step("dequeue", async () => {
		const stream = queue.dequeue();
		const reader = stream.getReader();

		const items = new Set(["a", "b", "c"]);

		const first = await reader.read();
		assert(first.done === false);
		items.delete(first.value.key);

		const second = await reader.read();
		assert(second.done === false);
		items.delete(second.value.key);

		const third = await reader.read();
		assert(third.done === false);
		items.delete(third.value.key);

		assert(items.size === 0);

		reader.releaseLock();
		stream.cancel();
	});
}

export async function testRateLimiterProvider(
	provider: RateLimiterProvider,
	t: Deno.TestContext,
): Promise<void> {
	await t.step("limit", async () => {
		assert(await provider.limit({ key: "a", limit: 2, period: 500 }));
		assert(await provider.limit({ key: "a", limit: 2, period: 500 }));
		assert(await provider.limit({ key: "b", limit: 2, period: 500 }));
		assertFalse(await provider.limit({ key: "a", limit: 2, period: 500 }));
		await new Promise((r) => setTimeout(r, 1000));
		assert(await provider.limit({ key: "a", limit: 2, period: 500 }));
	});
}

type User = {
	user_id: number;
	display: string;
	email: string;
	age: number;
};

type Post = {
	post_id: number;
	title: string;
	content: string;
	author_id: number;
};

type Tables = {
	users: User;
	posts: Post;
};

type InsertTables = {
	users: Omit<User, "user_id">;
	posts: Omit<Post, "post_id">;
};

const q = new BatchableStatementBuilder<Tables, InsertTables>();

async function seedUsers(provider: TableProvider): Promise<void> {
	const insertStmt = q.insert("users").values((q) => ({
		display: q.param("display"),
		email: q.param("email"),
		age: q.param("age"),
	})).toStatement();

	await provider.execute(
		insertStmt as TStatement<Record<string, unknown>, unknown>,
		{ display: "Alice", email: "alice@example.com", age: 30 },
	);
	await provider.execute(
		insertStmt as TStatement<Record<string, unknown>, unknown>,
		{ display: "Bob", email: "bob@example.com", age: 25 },
	);
	await provider.execute(
		insertStmt as TStatement<Record<string, unknown>, unknown>,
		{ display: "Charlie", email: "charlie@example.com", age: 35 },
	);
}

export async function testTableProvider(
	provider: TableProvider,
	t: Deno.TestContext,
): Promise<void> {
	await t.step("INSERT VALUES and SELECT all rows", async () => {
		await seedUsers(provider);

		const selectStmt = q.select("users")
			.map((q) => ({
				user_id: q.ref("users", "user_id"),
				display: q.ref("users", "display"),
				email: q.ref("users", "email"),
				age: q.ref("users", "age"),
			}))
			.toStatement();

		const rows = await provider.execute(
			selectStmt as TStatement<Record<string, unknown>, unknown>,
			{},
		) as Record<string, unknown>[];

		assertEquals(rows.length, 3);
		assertEquals(rows[0].display, "Alice");
		assertEquals(rows[1].display, "Bob");
		assertEquals(rows[2].display, "Charlie");
	});

	await t.step("SELECT with WHERE clause", async () => {
		const stmt = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
				age: q.ref("users", "age"),
			}))
			.where((q) => q.greaterThan(q.ref("users", "age"), q.param("minAge")))
			.toStatement();

		const rows = await provider.execute(
			stmt as TStatement<Record<string, unknown>, unknown>,
			{ minAge: 28 },
		) as Record<string, unknown>[];

		assertEquals(rows.length, 2);
		assertEquals(rows[0].display, "Alice");
		assertEquals(rows[1].display, "Charlie");
	});

	await t.step("SELECT with ORDER BY and LIMIT", async () => {
		const builder = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
				age: q.ref("users", "age"),
			}))
			.limit(2);

		// Manually inject orderBy since the builder doesn't expose a chainable method yet
		const built = builder.build();
		built.orderBy = [{ column: { type: "columnref", table: "users", column: "age" }, order: "DESC" }];
		const stmt: TStatement<Record<string, unknown>, unknown> = { type: "statement", statement: built };

		const rows = await provider.execute(stmt, {}) as Record<string, unknown>[];

		assertEquals(rows.length, 2);
		assertEquals(rows[0].display, "Charlie");
		assertEquals(rows[1].display, "Alice");
	});

	await t.step("SELECT with JOIN", async () => {
		// Insert a post for Alice (user_id = 1)
		const insertPost = q.insert("posts").values((q) => ({
			title: q.param("title"),
			content: q.param("content"),
			author_id: q.param("author_id"),
		})).toStatement();

		await provider.execute(
			insertPost as TStatement<Record<string, unknown>, unknown>,
			{ title: "Hello World", content: "My first post!", author_id: 1 },
		);

		const stmt = q.select("posts", "p")
			.join("users", "u", (q) => q.equal(q.ref("u", "user_id"), q.ref("p", "author_id")))
			.map((q) => ({
				post_title: q.ref("p", "title"),
				author_display: q.ref("u", "display"),
			}))
			.toStatement();

		const rows = await provider.execute(
			stmt as TStatement<Record<string, unknown>, unknown>,
			{},
		) as Record<string, unknown>[];

		assertEquals(rows.length, 1);
		assertEquals(rows[0].post_title, "Hello World");
		assertEquals(rows[0].author_display, "Alice");
	});

	await t.step("UPDATE with WHERE", async () => {
		const updateStmt = q.update("users")
			.set((q) => ({
				age: q.param("newAge"),
			}))
			.where((q) => q.equal(q.ref("users", "display"), q.param("name")))
			.toStatement();

		await provider.execute(
			updateStmt as TStatement<Record<string, unknown>, unknown>,
			{ newAge: 31, name: "Alice" },
		);

		const selectStmt = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
				age: q.ref("users", "age"),
			}))
			.where((q) => q.equal(q.ref("users", "display"), q.param("name")))
			.toStatement();

		const rows = await provider.execute(
			selectStmt as TStatement<Record<string, unknown>, unknown>,
			{ name: "Alice" },
		) as Record<string, unknown>[];

		assertEquals(rows.length, 1);
		assertEquals(rows[0].age, 31);
	});

	await t.step("DELETE with WHERE", async () => {
		const deleteStmt = q.delete("users")
			.where((q) => q.equal(q.ref("users", "display"), q.param("name")))
			.toStatement();

		await provider.execute(
			deleteStmt as TStatement<Record<string, unknown>, unknown>,
			{ name: "Bob" },
		);

		const selectStmt = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
			}))
			.toStatement();

		const rows = await provider.execute(
			selectStmt as TStatement<Record<string, unknown>, unknown>,
			{},
		) as Record<string, unknown>[];

		assertEquals(rows.length, 2);
		assertEquals(rows[0].display, "Alice");
		assertEquals(rows[1].display, "Charlie");
	});

	await t.step("BATCH with pre-condition checks", async () => {
		const batch = q.batch()
			.checkIfNotExists(
				q.select("users").where((q) => q.equal(q.ref("users", "display"), q.param("name"))),
			)
			.execute(
				q.insert("users").values((q) => ({
					display: q.param("name"),
					email: q.param("email"),
					age: q.param("age"),
				})),
			)
			.toStatement();

		await provider.execute(
			batch as TStatement<Record<string, unknown>, unknown>,
			{ name: "Dave", email: "dave@example.com", age: 40 },
		);

		const selectStmt = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
			}))
			.toStatement();

		const rows = await provider.execute(
			selectStmt as TStatement<Record<string, unknown>, unknown>,
			{},
		) as Record<string, unknown>[];

		// After seedUsers (3) - delete Bob (2) + insert Dave (3)
		assertEquals(rows.length, 3);
	});

	await t.step("BATCH fails when pre-condition not met", async () => {
		const batch = q.batch()
			.checkIfNotExists(
				q.select("users").where((q) => q.equal(q.ref("users", "display"), q.param("name"))),
			)
			.execute(
				q.insert("users").values((q) => ({
					display: q.param("name"),
					email: q.param("email"),
					age: q.param("age"),
				})),
			)
			.toStatement();

		await assertRejects(
			() =>
				provider.execute(
					batch as TStatement<Record<string, unknown>, unknown>,
					{ name: "Alice", email: "alice2@example.com", age: 99 },
				),
			Error,
			"pre-condition failed",
		);

		// Verify no additional Alice was inserted
		const selectStmt = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
			}))
			.toStatement();

		const rows = await provider.execute(
			selectStmt as TStatement<Record<string, unknown>, unknown>,
			{},
		) as Record<string, unknown>[];

		assertEquals(rows.length, 3);
	});

	await t.step("SELECT with WHERE equality on literal", async () => {
		// Dave has age 40 (inserted in batch step)
		const stmt = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
			}))
			.where((q) => q.equal(q.ref("users", "age"), q.literal(40)))
			.toStatement();

		const rows = await provider.execute(
			stmt as TStatement<Record<string, unknown>, unknown>,
			{},
		) as Record<string, unknown>[];

		assertEquals(rows.length, 1);
		assertEquals(rows[0].display, "Dave");
	});

	await t.step("SELECT with OFFSET", async () => {
		const builder = q.select("users")
			.map((q) => ({
				display: q.ref("users", "display"),
			}))
			.limit(2)
			.offset(1);

		// Manually inject orderBy
		const built = builder.build();
		built.orderBy = [{ column: { type: "columnref", table: "users", column: "user_id" }, order: "ASC" }];
		const stmt: TStatement<Record<string, unknown>, unknown> = { type: "statement", statement: built };

		const rows = await provider.execute(stmt, {}) as Record<string, unknown>[];

		assertEquals(rows.length, 2);
	});

	await t.step("INSERT FROM SELECT", async () => {
		// Insert from select: duplicate existing post for a different author
		// After previous steps: Alice (1), Charlie (3), Dave (4) exist; Bob (2) was deleted
		// The "Hello World" post belongs to author_id=1 (Alice)
		const insertFrom = q.insert("posts")
			.from((q) =>
				q.select("posts", "p")
					.where((q) => q.equal(q.ref("p", "author_id"), q.param("source_author")))
					.map((q) => ({
						title: q.ref("p", "title"),
						content: q.ref("p", "content"),
						author_id: q.param("target_author"),
					}))
			)
			.toStatement();

		await provider.execute(
			insertFrom as TStatement<Record<string, unknown>, unknown>,
			{ source_author: 1, target_author: 3 },
		);

		const selectPosts = q.select("posts")
			.map((q) => ({
				title: q.ref("posts", "title"),
				author_id: q.ref("posts", "author_id"),
			}))
			.toStatement();

		const rows = await provider.execute(
			selectPosts as TStatement<Record<string, unknown>, unknown>,
			{},
		) as Record<string, unknown>[];

		assertEquals(rows.length, 2);
		assertEquals(rows[0].author_id, 1);
		assertEquals(rows[1].author_id, 3);
		assertEquals(rows[0].title, "Hello World");
		assertEquals(rows[1].title, "Hello World");
	});
}

export async function testStorageProvider(
	provider: StorageProvider,
	t: Deno.TestContext,
): Promise<void> {
	await t.step("put stores content from ArrayBuffer", async () => {
		const data = new TextEncoder().encode("hello world");
		await provider.put("files/hello.txt", data.buffer, {
			contentType: "text/plain",
			etag: "",
			metadata: {},
		});
	});

	await t.step("get retrieves stored content", async () => {
		const stream = await provider.get("files/hello.txt");
		const reader = stream.getReader();
		const chunks: Uint8Array[] = [];
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}
		let totalLength = 0;
		for (const chunk of chunks) totalLength += chunk.byteLength;
		const merged = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			merged.set(chunk, offset);
			offset += chunk.byteLength;
		}
		assertEquals(new TextDecoder().decode(merged), "hello world");
	});

	await t.step("get throws StorageObjectNotFoundError for missing key", async () => {
		await assertRejects(
			() => provider.get("nonexistent/file.bin"),
			StorageObjectNotFoundError,
		);
	});

	await t.step("put stores content from Blob", async () => {
		const blob = new Blob(["blob content"], { type: "text/plain" });
		await provider.put("files/blob.txt", blob, { contentType: "text/plain", etag: "", metadata: {} });

		const stream = await provider.get("files/blob.txt");
		const text = await new Response(stream).text();
		assertEquals(text, "blob content");
	});

	await t.step("put stores content from ReadableStream", async () => {
		const data = new TextEncoder().encode("streamed content");
		const readable = new ReadableStream<Uint8Array>({
			start(controller): void {
				controller.enqueue(data);
				controller.close();
			},
		});
		await provider.put("files/stream.txt", readable, { contentType: "text/plain", etag: "", metadata: {} });

		const stream = await provider.get("files/stream.txt");
		const text = await new Response(stream).text();
		assertEquals(text, "streamed content");
	});

	await t.step("put overwrites existing content", async () => {
		await provider.put("files/hello.txt", new TextEncoder().encode("updated").buffer, {
			contentType: "text/plain",
			etag: "",
			metadata: {},
		});

		const stream = await provider.get("files/hello.txt");
		const text = await new Response(stream).text();
		assertEquals(text, "updated");
	});

	await t.step("getMetadata returns object metadata", async () => {
		const meta = await provider.getMetadata("files/hello.txt");
		assertEquals(meta.key, "files/hello.txt");
		assertEquals(meta.contentType, "text/plain");
		assertExists(meta.lastModified);
		assertExists(meta.etag);
	});

	await t.step("getMetadata throws StorageObjectNotFoundError for missing key", async () => {
		await assertRejects(
			() => provider.getMetadata("nonexistent/file.bin"),
			StorageObjectNotFoundError,
		);
	});

	await t.step("getSignedUploadUrl returns a signed URL", async () => {
		const result = await provider.getSignedUploadUrl("files/upload.txt", {
			contentType: "text/plain",
			metadata: { tag: "upload" },
		});
		assertEquals(typeof result.url, "string");
		assert(result.url.length > 0);
		assertExists(result.expiresAt);
	});

	await t.step("getSignedDownloadUrl returns a signed URL", async () => {
		const result = await provider.getSignedDownloadUrl("files/hello.txt");
		assertEquals(typeof result.url, "string");
		assert(result.url.length > 0);
		assertExists(result.expiresAt);
	});

	await t.step("getSignedDownloadUrl throws for missing key", async () => {
		await assertRejects(
			() => provider.getSignedDownloadUrl("nonexistent/file.bin"),
			StorageObjectNotFoundError,
		);
	});

	await t.step("list returns stored objects", async () => {
		const entries = await Array.fromAsync(provider.list({ prefix: "files" }));
		assert(entries.length >= 3); // hello.txt, blob.txt, stream.txt (+ upload.txt from signed-url)
		for (const entry of entries) {
			assert(entry.object.key.startsWith("files/"));
			assertExists(entry.cursor);
		}
	});

	await t.step("list with limit and cursor paginates", async () => {
		const page1 = await Array.fromAsync(provider.list({ prefix: "files", limit: 2 }));
		assertEquals(page1.length, 2);

		const page2 = await Array.fromAsync(
			provider.list({ prefix: "files", limit: 2, cursor: page1[page1.length - 1].cursor }),
		);
		assert(page2.length > 0);

		// No overlap between pages
		const page1Keys = new Set(page1.map((e) => e.object.key));
		for (const entry of page2) {
			assertFalse(page1Keys.has(entry.object.key));
		}
	});

	await t.step("list returns empty for unknown prefix", async () => {
		const entries = await Array.fromAsync(provider.list({ prefix: "unknown" }));
		assertEquals(entries.length, 0);
	});

	await t.step("delete removes the object", async () => {
		await provider.delete("files/blob.txt");

		await assertRejects(
			() => provider.get("files/blob.txt"),
			StorageObjectNotFoundError,
		);
		await assertRejects(
			() => provider.getMetadata("files/blob.txt"),
			StorageObjectNotFoundError,
		);
	});

	await t.step("getSignedUploadUrl with conditions returns a signed URL", async () => {
		const result = await provider.getSignedUploadUrl("files/conditioned.txt", {
			contentType: "text/plain",
			conditions: {
				"accept": ["text/plain"],
				"contentLengthRange": { max: 1048576 },
			},
		});
		assertEquals(typeof result.url, "string");
		assert(result.url.length > 0);
		assertExists(result.expiresAt);
	});

	await t.step("delete on missing key does not throw", async () => {
		await provider.delete("nonexistent/file.bin");
	});
}
