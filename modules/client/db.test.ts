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
	DatabaseDescriptor,
	DatabasePermissions,
	functions,
	mail,
} from "https://baseless.dev/x/worker/mod.ts";
import { createLogger } from "https://baseless.dev/x/logger/mod.ts";
import { collection, createDoc, doc, getDatabase, getDocs } from "./db.ts";

async function setupServer(
	dbDescriptor: DatabaseDescriptor = database.build(),
) {
	const dbStorage = new SqliteKVProvider(":memory:");
	const dbProvider = new DatabaseOnKvProvider(dbStorage);

	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const clientProvider = new MemoryClientProvider([
		new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey),
	]);

	await dbStorage.open();
	const dispose = async () => {
		await dbStorage.close();
	};

	const server = new Server(
		auth.build(),
		dbDescriptor,
		functions.build(),
		mail.build(),
		clientProvider,
		undefined,
		undefined,
		dbProvider,
	);

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

Deno.test("createDoc", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabasePermissions.Create);
	builder.collection("/users").permission(DatabasePermissions.List);
	builder.document("/posts/:post").permission(DatabasePermissions.Get);
	builder.document("/users/:user").permission(DatabasePermissions.Get);
	const { server, dispose: disposeServer, publicKey } = await setupServer(builder.build());
	const { db, dispose: disposeApp } = await setupApp(server, publicKey);

	await assertRejects(() => createDoc(db, doc("/unknown/a"), {}));
	await assertRejects(() => createDoc(db, doc("/users/a"), {}));

	const postA = await createDoc<{ title: string }>(db, doc("/posts/a"), { title: "A" });
	assertExists(postA);
	assertEquals(postA.metadata.title, "A");

	await disposeApp();
	await disposeServer();
});

Deno.test("getDocs", async () => {
	const builder = new DatabaseBuilder();
	builder.collection("/posts").permission(DatabasePermissions.Create | DatabasePermissions.List);
	builder.document("/posts/:post").permission(DatabasePermissions.Get);
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
