import * as App from "../app.ts";
import * as Type from "@baseless/core/schema";
import { assertEquals } from "@std/assert/equals";
import createMemoryServer, { pubsub } from "../server.test.ts";
import { Document, DocumentListEntry } from "@baseless/core/document";

Deno.test("Document application", async (t) => {
	// deno-lint-ignore no-explicit-any
	const documentEvents: any[] = [];
	using mock = await createMemoryServer({
		collectionPost: App.collection("post", Type.String(), Type.String(), () => App.Permission.All),
		topicPost: App.onTopicMessage("post/:pid", ({ message, params }) => {
			documentEvents.push({ ...message.data, pid: params.pid });
		}),
	});

	await mock.provider.document.atomic()
		.set("post/a", "A")
		.set("post/b", "B")
		.set("post/c", "C")
		.commit();

	await t.step("document/get", async () => {
		const resp = await mock.post("/document/get", { data: { path: "post/a" }, schema: Document });
		assertEquals(resp.key, "post/a");
		assertEquals(resp.data, "A");
	});

	await t.step("document/get-many", async () => {
		const resp = await mock.post("/document/get-many", { data: { paths: ["post/a", "post/b", "post/c"] }, schema: Type.Array(Document) });
		assertEquals(resp.length, 3);
		assertEquals(resp[0].key, "post/a");
		assertEquals(resp[0].data, "A");
		assertEquals(resp[1].key, "post/b");
		assertEquals(resp[1].data, "B");
		assertEquals(resp[2].key, "post/c");
		assertEquals(resp[2].data, "C");
	});

	await t.step("document/list", async () => {
		const resp = await mock.post("/document/list", { data: { prefix: "post", limit: 2 }, schema: Type.Array(DocumentListEntry) });
		assertEquals(resp.length, 2);
		assertEquals(resp[0].document.key, "post/a");
		assertEquals(resp[0].document.data, "A");
		assertEquals(resp[1].document.key, "post/b");
		assertEquals(resp[1].document.data, "B");
	});

	await t.step("document/commit", async () => {
		using stream = pubsub(mock);
		await mock.post("/document/commit", { data: { checks: [], operations: [{ type: "set", key: "post/d", data: "D" }] } });
		const postD = await mock.service.document.get("post/d");
		assertEquals(postD.data, "D");
		await stream.next();
		assertEquals(documentEvents, [{ pid: "d", type: "set", document: "D" }]);
	});
});
