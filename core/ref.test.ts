import { assertEquals, assertThrows } from "@std/assert";
import { assertReference, isReference, ref } from "./ref.ts";

Deno.test("ref", async (t) => {
	await t.step("isReference", () => {
		assertEquals(isReference(ref("foo")), true);
		assertEquals(isReference(ref("foo/:bar", { bar: "bar" })), true);
		assertEquals(isReference("foo", ref("foo")), true);
		assertEquals(isReference("foo", ref("bar")), false);
		assertEquals(isReference("foo", ""), false);
	});
	await t.step("assertReference", () => {
		assertReference(ref("foo"));
		assertReference(ref("foo/:bar", { bar: "bar" }));
		assertThrows(() => assertReference("foo", ref("bar")));
		assertThrows(() => assertReference("foo", ""));
	});
});
