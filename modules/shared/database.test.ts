import { assertEquals, assertExists, assertThrows } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { collection, CollectionReference, doc, DocumentReference } from "./database.ts";

Deno.test("collection reference", async (t) => {
	await t.step("must have odd segments", () => {
		assertThrows(() => new CollectionReference("a", "1"));
		assertThrows(() => new CollectionReference("a", "1", "b", "2"));
		assertThrows(() => collection("a", "1"));
		assertThrows(() => collection("/a/1"));
		assertThrows(() => collection("a", "1", "b", "2"));
		assertThrows(() => collection("/a/1/b/2"));
	});
	await t.step("toString returns an absolute path", () => {
		assertEquals(collection("a").toString(), "/a");
		assertEquals(collection("a/1/b").toString(), "/a/1/b");
	});
});

Deno.test("document reference", async (t) => {
	await t.step("odd segments append autoid", () => {
		assertExists(new DocumentReference(new CollectionReference("a")).id);
		assertExists(doc(collection("/a")).id);
	});
	await t.step("toString returns an absolute path", () => {
		assertExists(doc(collection("/a"), "1").toString(), "/a/1");
		assertExists(doc(collection("/a/1/b"), "2").toString(), "/a/1/b/2");
	});
});
