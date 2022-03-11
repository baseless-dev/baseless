import {
	assertEquals,
	assertExists,
	assertNotEquals,
	assertRejects,
} from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.3.7/key/generate_key_pair.ts";
import {
	Client,
	Context,
	NoopAuthProvider,
	NoopChannelProvider,
	NoopKVProvider,
	NoopMailProvider,
} from "https://baseless.dev/x/provider/mod.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/provider-kv-sqlite/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/provider-db-on-kv/mod.ts";
import { createLogger } from "https://baseless.dev/x/logger/mod.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.3.7/jwt/verify.ts";
import {
	DatabaseBuilder,
	DatabaseCollectionPermissions,
	DatabaseDocumentPermissions,
} from "https://baseless.dev/x/worker/mod.ts";
import { DatabaseController } from "./database.ts";
import { collection, doc } from "https://baseless.dev/x/shared/mod.ts";

async function setupContext() {
	const { privateKey, publicKey } = await generateKeyPair("RS256");

	const client = new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey);

	const waitUntilCollection: PromiseLike<unknown>[] = [];

	const db = new SqliteKVProvider(":memory:");
	await db.open();

	const context: Context = {
		auth: new NoopAuthProvider(),
		client: client,
		kv: new NoopKVProvider(),
		database: new DatabaseOnKvProvider(db),
		mail: new NoopMailProvider(),
		// channel: new NoopChannelProvider(),
		waitUntil(promise) {
			waitUntilCollection.push(promise);
		},
	};

	const dispose = async () => {
		await db.close();
	};

	return { context, dispose, waitUntilCollection, client };
}

Deno.test("create document", async () => {
	const { context, dispose } = await setupContext();

	{ // Create on unknown collection throws
		const db = new DatabaseBuilder();
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.create(context, doc("/posts/abc"), { title: "A" }));
	}
	{ // Create on known collection without Create permission throws
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.List);
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.create(context, doc("/posts/abc"), { title: "A" }));
	}
	{ // Create document
		const db = new DatabaseBuilder();
		let triggered = 0;
		db.collection("/posts").permission(DatabaseCollectionPermissions.List | DatabaseCollectionPermissions.Create)
			.onCreate(
				// deno-lint-ignore require-await
				async () => {
					triggered++;
				},
			);
		const dbController = new DatabaseController(db.build());
		assertEquals({}, await dbController.create(context, doc("/posts/abc"), { title: "A" }));
		assertEquals(triggered, 1);
	}

	await dispose();
});

Deno.test("get document", async () => {
	const { context, dispose } = await setupContext();

	{ // Get document on unknown collection throws
		const db = new DatabaseBuilder();
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.get(context, doc("/posts/abc")));
	}
	{ // Get document on known collection without Get permission throws
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.List);
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.get(context, doc("/posts/abc")));
	}
	{ // Get document
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.List | DatabaseCollectionPermissions.Create);
		db.document("/posts/:post").permission(DatabaseDocumentPermissions.Get);
		const dbController = new DatabaseController(db.build());

		await dbController.create(context, doc("/posts/abc"), { title: "A" });
		assertEquals({ data: {}, metadata: { title: "A" } }, await dbController.get(context, doc("/posts/abc")));
	}

	await dispose();
});

Deno.test("list documents", async () => {
	const { context, dispose } = await setupContext();

	{ // List document on unknown collection throws
		const db = new DatabaseBuilder();
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.list(context, collection("/posts")));
	}
	{ // List document on known collection without List permission throws
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.None);
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.list(context, collection("/posts")));
	}
	{ // List documents
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.List | DatabaseCollectionPermissions.Create);
		db.document("/posts/:post").permission(DatabaseDocumentPermissions.Get);
		const dbController = new DatabaseController(db.build());

		await dbController.create(context, doc("/posts/a"), { title: "A" });
		await dbController.create(context, doc("/posts/c"), { title: "C" });
		await dbController.create(context, doc("/posts/b"), { title: "B" });
		assertEquals({
			docs: [
				{ ref: "/posts/a", data: {}, metadata: { title: "A" } },
				{ ref: "/posts/b", data: {}, metadata: { title: "B" } },
				{ ref: "/posts/c", data: {}, metadata: { title: "C" } },
			],
		}, await dbController.list(context, collection("/posts")));
	}

	await dispose();
});

Deno.test("list documents with filter", async () => {
	const { context, dispose } = await setupContext();

	{ // List documents
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.List | DatabaseCollectionPermissions.Create);
		db.document("/posts/:post").permission(DatabaseDocumentPermissions.Get);
		const dbController = new DatabaseController(db.build());

		await dbController.create(context, doc("/posts/a"), { title: "A" });
		await dbController.create(context, doc("/posts/c"), { title: "C" });
		await dbController.create(context, doc("/posts/b"), { title: "B" });
		assertEquals({
			docs: [
				{ ref: "/posts/b", data: {}, metadata: { title: "B" } },
				{ ref: "/posts/c", data: {}, metadata: { title: "C" } },
			],
		}, await dbController.list(context, collection("/posts"), { title: { gt: "A" } }));
	}

	await dispose();
});

Deno.test("update document", async () => {
	const { context, dispose } = await setupContext();

	{ // Update document on unknown collection throws
		const db = new DatabaseBuilder();
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.update(context, doc("/posts/a"), { title: "AAA" }));
	}
	{ // Update document on known collection without Update permission throws
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.List);
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.update(context, doc("/posts/a"), { title: "AAA" }));
	}
	{ // Update document
		const db = new DatabaseBuilder();
		let triggered = 0;
		db.collection("/posts").permission(DatabaseCollectionPermissions.List | DatabaseCollectionPermissions.Create);
		// deno-lint-ignore require-await
		db.document("/posts/:post").permission(DatabaseDocumentPermissions.Get | DatabaseDocumentPermissions.Update)
			.onUpdate(async () => {
				triggered++;
			});
		const dbController = new DatabaseController(db.build());

		await dbController.create(context, doc("/posts/a"), { title: "A" });
		await dbController.create(context, doc("/posts/c"), { title: "C" });
		await dbController.create(context, doc("/posts/b"), { title: "B" });
		await dbController.update(context, doc("/posts/a"), { title: "AAA" });
		assertEquals(triggered, 1);
		assertEquals({ data: {}, metadata: { title: "AAA" } }, await dbController.get(context, doc("/posts/a")));
	}

	await dispose();
});

Deno.test("delete document", async () => {
	const { context, dispose } = await setupContext();

	{ // Delete document on unknown collection throws
		const db = new DatabaseBuilder();
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.delete(context, doc("/posts/a")));
	}
	{ // Delete document on known collection without Update permission throws
		const db = new DatabaseBuilder();
		db.collection("/posts").permission(DatabaseCollectionPermissions.List);
		const dbController = new DatabaseController(db.build());
		await assertRejects(() => dbController.delete(context, doc("/posts/a")));
	}
	{ // Delete document
		const db = new DatabaseBuilder();
		let triggered = 0;
		db.collection("/posts").permission(DatabaseCollectionPermissions.List | DatabaseCollectionPermissions.Create);
		// deno-lint-ignore require-await
		db.document("/posts/:post").permission(DatabaseDocumentPermissions.Get | DatabaseDocumentPermissions.Delete)
			.onDelete(async () => {
				triggered++;
			});
		const dbController = new DatabaseController(db.build());

		await dbController.create(context, doc("/posts/a"), { title: "A" });
		await dbController.create(context, doc("/posts/c"), { title: "C" });
		await dbController.create(context, doc("/posts/b"), { title: "B" });
		await dbController.delete(context, doc("/posts/b"));
		assertEquals(triggered, 1);
		assertEquals({
			docs: [
				{ ref: "/posts/a", data: {}, metadata: { title: "A" } },
				{ ref: "/posts/c", data: {}, metadata: { title: "C" } },
			],
		}, await dbController.list(context, collection("/posts")));
	}

	await dispose();
});
