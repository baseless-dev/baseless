import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { assertEquals } from "@std/assert/equals";
import createMemoryServer, { connect, pubsub, serve } from "../server.test.ts";
import { Document, DocumentListEntry } from "@baseless/core/document";
import documentApp from "./document.ts";

Deno.test("Document application", async (t) => {
	// deno-lint-ignore no-explicit-any
	const onDocumentSetting: any[] = [];
	const onTopicMessage: any[] = [];
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
		const resp = await mock.fetch("/core/document/get", { data: { path: "post/a" }, schema: z.object({ document: Document() }) });
		assertEquals(resp.document.key, "post/a");
		assertEquals(resp.document.data, "A");
	});

	await t.step("get many documents", async () => {
		const resp = await mock.fetch("/core/document/get-many", {
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
		const resp = await mock.fetch("/core/document/list", {
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

		await mock.fetch("/core/document/commit", {
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
