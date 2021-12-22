import {
	assertEquals,
	assertNotEquals,
} from "https://deno.land/std@0.118.0/testing/asserts.ts";

import { collection, doc } from "./database.ts";

Deno.test("parse collection reference", () => {
	assertEquals(collection("users").segments.length, 1);
	assertEquals(collection("users", "abc", "comments").segments.length, 3);
	assertEquals(collection("/users/abc/comments").segments.length, 3);
});

Deno.test("parse document reference", () => {
	assertEquals(doc("users", "abc").collection.toString(), "/users");
	assertEquals(doc("users", "abc").id, "abc");
	assertEquals(
		doc("users", "abc", "comments", "123").collection.toString(),
		"/users/abc/comments",
	);
	assertEquals(doc("users", "abc", "comments", "123").id, "123");
	assertEquals(
		doc("/users/abc/comments/123").collection.toString(),
		"/users/abc/comments",
	);
	assertEquals(doc("/users/abc/comments/123").id, "123");
});

Deno.test("generate document id", () => {
	assertEquals(doc(collection("users", "abc", "comments")).id.length, 20);
});
