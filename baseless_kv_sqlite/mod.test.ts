import {
	assertEquals,
	assertNotEquals,
} from "https://deno.land/std@0.118.0/testing/asserts.ts";
import * as log from "https://deno.land/std@0.118.0/log/mod.ts";

await log.setup({
	handlers: {
		console: new log.handlers.ConsoleHandler("DEBUG"),
	},
	loggers: {
		baseless_kv_sqlite: {
			level: "DEBUG",
			handlers: ["console"],
		},
	},
});

import { SqliteKVProvider } from "./mod.ts";

Deno.test("open & close", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	await kv.close();
});
Deno.test("set & get", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	await kv.set("/posts/a", { title: "Title A" });
	const doc = await kv.get<{ title: string }>("/posts/a");
	assertEquals(doc.metadata.title, "Title A");
	await kv.close();
});
Deno.test("list", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	await Promise.all([
		kv.set("/posts/a", { title: "Title A" }),
		kv.set("/posts/b", { title: "Title B" }),
		kv.set("/posts/b/comments/a", { title: "Comment A on B" }),
		kv.set("/posts/c", { title: "Title C" }),
		kv.set("/posts/d", { title: "Title D" }),
	]);
	const docs = await kv.list<{ title: string }>("/posts");
	assertEquals(docs.length, 5);
	assertEquals(docs[0].key, "/posts/a");
	assertEquals(docs[0].metadata.title, "Title A");
	assertEquals(docs[1].key, "/posts/b");
	assertEquals(docs[1].metadata.title, "Title B");
	assertEquals(docs[2].key, "/posts/b/comments/a");
	assertEquals(docs[2].metadata.title, "Comment A on B");
	assertEquals(docs[3].key, "/posts/c");
	assertEquals(docs[3].metadata.title, "Title C");
	assertEquals(docs[4].key, "/posts/d");
	assertEquals(docs[4].metadata.title, "Title D");
	await kv.close();
});
Deno.test("list & filter", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	await Promise.all([
		kv.set("/posts/a", { title: "Title A" }),
		kv.set("/posts/b", { title: "Title B" }),
		kv.set("/posts/c", { title: "Title C" }),
		kv.set("/posts/d", { title: "Title D" }),
	]);
	const docs = await kv.list("/posts", { title: { eq: "Title B" } });
	assertEquals(docs.length, 1);
	assertEquals(docs[0].key, "/posts/b");
	assertEquals(docs[0].metadata.title, "Title B");
	await kv.close();
});
Deno.test("delete", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	await Promise.all([
		kv.set("/posts/a", { title: "Title A" }),
		kv.set("/posts/b", { title: "Title B" }),
		kv.set("/posts/c", { title: "Title C" }),
		kv.set("/posts/d", { title: "Title D" }),
	]);
	await kv.delete("/posts/b");
	const docs = await kv.list<{ title: string }>("/posts");
	assertEquals(docs.length, 3);
	assertEquals(docs[0].key, "/posts/a");
	assertEquals(docs[0].metadata.title, "Title A");
	assertEquals(docs[1].key, "/posts/c");
	assertEquals(docs[1].metadata.title, "Title C");
	assertEquals(docs[2].key, "/posts/d");
	assertEquals(docs[2].metadata.title, "Title D");
	await kv.close();
});
