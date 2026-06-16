import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { assertEquals, assertInstanceOf } from "@std/assert";
import createMemoryServer, { connect, pubsub, serve } from "../server.test.ts";
import { Document, DocumentListEntry } from "@baseless/core/document";
import { DocumentAtomicCommitError } from "@baseless/core/errors";
import documentApp from "./document.ts";

Deno.test("Document application", async (t) => {
	const onDocumentSetting: unknown[] = [];
	const onTopicMessage: unknown[] = [];
	using mock = await createMemoryServer({
		app: app()
			.extend(documentApp)
			.collection({
				path: "post",
				schema: z.string(),
				collectionSecurity: () => Permission.All,
				documentSecurity: () => Permission.All,
				topicSecurity: () => Permission.All,
			})
			.onDocumentSetting({
				path: "post/:key",
				handler({ document }): void {
					onDocumentSetting.push(document);
				},
			})
			.onTopicMessage({
				path: "post/:key",
				handler({ message }): void {
					onTopicMessage.push(message.data);
				},
			})
			.build(),
		configuration: {},
	});

	await mock.provider.document.atomic()
		.set("post/a", "A")
		.set("post/b", "B")
		.set("post/c", "C")
		.commit();

	await t.step("get document", async () => {
		const resp = await mock.fetch("/document/get", { data: { path: "post/a" }, schema: z.object({ document: Document() }) });
		assertEquals(resp.document.key, "post/a");
		assertEquals(resp.document.data, "A");
	});

	await t.step("get many documents", async () => {
		const resp = await mock.fetch("/document/get-many", {
			data: { paths: ["post/a", "post/b", "post/c"] },
			schema: z.object({ documents: z.array(Document()) }),
		});
		assertEquals(resp.documents.length, 3);
		assertEquals(resp.documents[0].key, "post/a");
		assertEquals(resp.documents[0].data, "A");
		assertEquals(resp.documents[1].key, "post/b");
		assertEquals(resp.documents[1].data, "B");
		assertEquals(resp.documents[2].key, "post/c");
		assertEquals(resp.documents[2].data, "C");
	});

	await t.step("list documents", async () => {
		const resp = await mock.fetch("/document/list", {
			data: { options: { prefix: "post", limit: 2 } },
			schema: z.object({ documents: z.array(DocumentListEntry()) }),
		});
		assertEquals(resp.documents.length, 2);
		assertEquals(resp.documents[0].document.key, "post/a");
		assertEquals(resp.documents[0].document.data, "A");
		assertEquals(resp.documents[1].document.key, "post/b");
		assertEquals(resp.documents[1].document.data, "B");
	});

	await t.step("commit", async () => {
		using server = await serve(mock.server);
		const url = new URL(server.url);
		url.protocol = "ws";
		using ws = connect(url, ["bls"]);
		await using stream = pubsub(mock);

		assertEquals(await ws.readyState(), WebSocket.OPEN);

		await ws.send(JSON.stringify({ type: "subscribe", key: "post" }));

		await mock.fetch("/document/commit", {
			data: { atomic: { checks: [], operations: [{ type: "set", key: "post/d", data: "D" }] } },
		});
		await stream.next();
		await stream.next();

		assertEquals(onDocumentSetting, [{ key: "post/d", data: "D", versionstamp: "" }]);
		assertEquals(onTopicMessage, [{ type: "set", document: { key: "post/d", data: "D", versionstamp: "" } }]);

		const { data } = await ws.message();
		assertEquals(
			data,
			JSON.stringify({ key: "post", payload: { type: "set", document: { key: "post/d", data: "D", versionstamp: "" } } }),
		);
	});
});

Deno.test("Document permission regression", async (t) => {
	// Register a collection with only Get | Set (no Delete) and a security-less document.
	using mock = await createMemoryServer({
		app: app()
			.extend(documentApp)
			// Set-only collection: callers may Get and Set, but not Delete.
			.collection({
				path: "restricted",
				schema: z.string(),
				collectionSecurity: () => Permission.All,
				documentSecurity: () => Permission.Get | Permission.Set,
				topicSecurity: () => Permission.None,
			})
			// Security-less (server-private) document: no documentSecurity handler.
			// The builder accepts ServerDocumentDefinition which omits documentSecurity,
			// so ops on this document must not be silently dropped.
			.document({
				path: "internal/config",
				schema: z.string(),
			})
			.build(),
		configuration: {},
	});

	await t.step("set with Set-only permission succeeds (regression for wrong boolean)", async () => {
		// Before the fix, a set op would also check Permission.Delete because the
		// second clause `(permission & Permission.Delete) == 0` fired regardless of op type.
		await mock.fetch("/document/commit", {
			data: { atomic: { checks: [], operations: [{ type: "set", key: "restricted/x", data: "hello" }] } },
		});
		const resp = await mock.fetch("/document/get", {
			data: { path: "restricted/x" },
			schema: z.object({ document: Document() }),
		});
		assertEquals(resp.document.data, "hello");
	});

	await t.step("delete without Delete permission is denied", async () => {
		// Seed a document first via the provider directly so we can attempt to delete it.
		await mock.provider.document.atomic().set("restricted/y", "seed").commit();

		let threw: unknown;
		try {
			await mock.fetch("/document/commit", {
				data: { atomic: { checks: [], operations: [{ type: "delete", key: "restricted/y" }] } },
			});
		} catch (err) {
			threw = err;
		}
		assertInstanceOf(threw, DocumentAtomicCommitError);
	});

	await t.step("ops on a security-less document are not silently dropped (regression for op-outside-guard)", async () => {
		// Before the fix, atomic.set was inside the `if ("documentSecurity" in definition)`
		// block, so writes to server-private documents were silently skipped.
		await mock.fetch("/document/commit", {
			data: { atomic: { checks: [], operations: [{ type: "set", key: "internal/config", data: "v1" }] } },
		});
		const resp = await mock.fetch("/document/get", {
			data: { path: "internal/config" },
			schema: z.object({ document: Document() }),
		});
		assertEquals(resp.document.data, "v1");
	});
});
