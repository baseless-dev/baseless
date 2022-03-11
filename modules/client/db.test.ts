import {
	assertEquals,
	assertExists,
	assertNotEquals,
	assertRejects,
} from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { Server } from "https://baseless.dev/x/server/server.ts";
import { initializeAppWithTransport } from "./app.ts";
import { LocalTransport } from "./transports/mod.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.3.7/key/generate_key_pair.ts";
import { exportSPKI } from "https://deno.land/x/jose@v4.3.7/key/export.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
import { Client } from "https://baseless.dev/x/provider/client.ts";
import { MemoryClientProvider } from "https://baseless.dev/x/provider-client-memory/mod.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/provider-kv-sqlite/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/provider-db-on-kv/mod.ts";
import {
	auth,
	database,
	DatabaseBuilder,
	DatabaseCollectionPermissions,
	DatabaseDescriptor,
	DatabaseDocumentPermissions,
	functions,
	mail,
	message,
} from "https://baseless.dev/x/worker/mod.ts";
import { createLogger } from "https://baseless.dev/x/logger/mod.ts";
import { collection, createDoc, deleteDoc, doc, getDatabase, getDoc, getDocs, replaceDoc, updateDoc } from "./db.ts";

async function setupServer(
	databaseDescriptor: DatabaseDescriptor = database.build(),
) {
	const dbStorage = new SqliteKVProvider(":memory:");
	const databaseProvider = new DatabaseOnKvProvider(dbStorage);

	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const clientProvider = new MemoryClientProvider([
		new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey),
	]);

	await dbStorage.open();
	const dispose = async () => {
		await dbStorage.close();
	};

	const server = new Server({
		authDescriptor: auth.build(),
		databaseDescriptor,
		functionsDescriptor: functions.build(),
		mailDescriptor: mail.build(),
		messageDescriptor: message.build(),
		clientProvider,
		databaseProvider,
	});

	return { server, dispose, publicKey };
}

async function setupApp(server: Server, publicKey: KeyLike) {
	const clientPublicKey = await exportSPKI(publicKey);
	const app = await initializeAppWithTransport({
		transport: new LocalTransport(server),
		clientPublicKey,
		clientPublicKeyAlg: "RS256",
		clientId: "foo",
	});
	const db = await getDatabase(app);
	const dispose = () => {
	};
	return { app, db, dispose };
}

Deno.test("create document", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabaseCollectionPermissions.Create);
	builder.collection("/users").permission(DatabaseCollectionPermissions.List);
	builder.document("/posts/:post").permission(DatabaseDocumentPermissions.Get);
	builder.document("/users/:user").permission(DatabaseDocumentPermissions.Get);
	const { server, dispose: disposeServer, publicKey } = await setupServer(builder.build());
	const { db, dispose: disposeApp } = await setupApp(server, publicKey);

	await assertRejects(() => createDoc(db, doc("/unknown/a"), {}));
	await assertRejects(() => createDoc(db, doc("/users/a"), {}));

	const postA = await createDoc<{ title: string }>(db, doc("/posts/a"), { title: "A" });
	assertExists(postA);
	assertEquals(postA.metadata.title, "A");

	await assertRejects(() => createDoc(db, doc("/posts/a"), {}));

	await disposeApp();
	await disposeServer();
});

Deno.test("list documents", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabaseCollectionPermissions.Create | DatabaseCollectionPermissions.List);
	builder.document("/posts/:post").permission(DatabaseDocumentPermissions.Get);
	const { server, dispose: disposeServer, publicKey } = await setupServer(builder.build());
	const { db, dispose: disposeApp } = await setupApp(server, publicKey);

	await createDoc(db, doc("/posts/a"), { title: "A" });
	await createDoc(db, doc("/posts/c"), { title: "C" });
	await createDoc(db, doc("/posts/b"), { title: "B" });

	{ // Get all docs
		const posts = await getDocs<{ title: string }>(db, collection("/posts"));
		assertEquals(posts.length, 3);
		assertEquals(posts[0].ref.toString(), "/posts/a");
		assertEquals(posts[0].metadata.title, "A");
		assertEquals(posts[1].ref.toString(), "/posts/b");
		assertEquals(posts[1].metadata.title, "B");
		assertEquals(posts[2].ref.toString(), "/posts/c");
		assertEquals(posts[2].metadata.title, "C");
	}
	{ // Get filtered docs
		const posts = await getDocs<{ title: string }>(db, collection("/posts"), { title: { gt: "A" } });
		assertEquals(posts.length, 2);
		assertEquals(posts[0].ref.toString(), "/posts/b");
		assertEquals(posts[0].metadata.title, "B");
		assertEquals(posts[1].ref.toString(), "/posts/c");
		assertEquals(posts[1].metadata.title, "C");
	}

	await disposeApp();
	await disposeServer();
});

Deno.test("get document", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabaseCollectionPermissions.Create | DatabaseCollectionPermissions.List);
	builder.document("/posts/:post").permission(DatabaseDocumentPermissions.Get);
	const { server, dispose: disposeServer, publicKey } = await setupServer(builder.build());
	const { db, dispose: disposeApp } = await setupApp(server, publicKey);

	await createDoc(db, doc("/posts/a"), { title: "A" });
	await createDoc(db, doc("/posts/c"), { title: "C" });
	await createDoc(db, doc("/posts/b"), { title: "B" });

	{ // Get document
		const post = await getDoc<{ title: string }>(db, doc("/posts/a"));
		assertEquals(post.ref.toString(), "/posts/a");
		assertEquals(post.metadata.title, "A");
	}
	{ // Get unknown document
		await assertRejects(() => getDoc(db, doc("/posts/z")));
	}

	await disposeApp();
	await disposeServer();
});

Deno.test("update document", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabaseCollectionPermissions.Create | DatabaseCollectionPermissions.List);
	builder.document("/posts/:post").permission(DatabaseDocumentPermissions.Get | DatabaseDocumentPermissions.Update);
	const { server, dispose: disposeServer, publicKey } = await setupServer(builder.build());
	const { db, dispose: disposeApp } = await setupApp(server, publicKey);

	await createDoc(db, doc("/posts/a"), { title: "A" });

	{ // Update document
		await updateDoc(db, doc("/posts/a"), { content: "AAA..." });
		const post = await getDoc<{ title: string; content: string }>(db, doc("/posts/a"));
		assertEquals(post.ref.toString(), "/posts/a");
		assertEquals(post.metadata.title, "A");
		assertEquals(post.metadata.content, "AAA...");
	}
	{ // Update unknown document
		await assertRejects(() => updateDoc(db, doc("/posts/z"), { title: "ZZZ" }));
	}

	await disposeApp();
	await disposeServer();
});

Deno.test("replace document", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabaseCollectionPermissions.Create | DatabaseCollectionPermissions.List);
	builder.document("/posts/:post").permission(DatabaseDocumentPermissions.Get | DatabaseDocumentPermissions.Update);
	const { server, dispose: disposeServer, publicKey } = await setupServer(builder.build());
	const { db, dispose: disposeApp } = await setupApp(server, publicKey);

	await createDoc(db, doc("/posts/a"), { title: "A" });

	{ // Replace document
		await replaceDoc(db, doc("/posts/a"), { content: "AAA..." });
		const post = await getDoc<{ title: string; content: string }>(db, doc("/posts/a"));
		assertEquals(post.ref.toString(), "/posts/a");
		assertEquals(post.metadata.title, undefined);
		assertEquals(post.metadata.content, "AAA...");
	}
	{ // Replace unknown document
		await assertRejects(() => replaceDoc(db, doc("/posts/z"), { title: "ZZZ" }));
	}

	await disposeApp();
	await disposeServer();
});

Deno.test("delete document", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabaseCollectionPermissions.Create | DatabaseCollectionPermissions.List);
	builder.document("/posts/:post").permission(DatabaseDocumentPermissions.Get | DatabaseDocumentPermissions.Delete);
	const { server, dispose: disposeServer, publicKey } = await setupServer(builder.build());
	const { db, dispose: disposeApp } = await setupApp(server, publicKey);

	await createDoc(db, doc("/posts/a"), { title: "A" });
	await createDoc(db, doc("/posts/c"), { title: "C" });
	await createDoc(db, doc("/posts/b"), { title: "B" });

	{ // Delete document
		await deleteDoc(db, doc("/posts/a"));
		const posts = await getDocs<{ title: string }>(db, collection("/posts"));
		assertEquals(posts.length, 2);
		assertEquals(posts[0].ref.toString(), "/posts/b");
		assertEquals(posts[0].metadata.title, "B");
		assertEquals(posts[1].ref.toString(), "/posts/c");
		assertEquals(posts[1].metadata.title, "C");
	}
	{ // Delete unknown document
		await deleteDoc(db, doc("/posts/z"));
	}

	await disposeApp();
	await disposeServer();
});
