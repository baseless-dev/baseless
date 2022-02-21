import { assertEquals, assertNotEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { autoid } from "./autoid.ts";

Deno.test("generates specified length", () => {
	assertEquals(autoid(10).length, 10);
	assertEquals(autoid(20).length, 20);
	assertEquals(autoid(40).length, 40);
});

Deno.test("no two autoid are equal in short amount of time", () => {
	const id = autoid(10);
	assertNotEquals(id, autoid(10));
	assertNotEquals(id, autoid(10));
	assertNotEquals(id, autoid(10));
	assertNotEquals(id, autoid(10));
	assertNotEquals(id, autoid(10));
	assertNotEquals(id, autoid(10));
});
