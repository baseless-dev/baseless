import { assert, assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { assertID, ID, id, isID, ksuid, rksuid } from "./id.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("ID", async (t) => {
	await t.step("id", () => {
		assertEquals(id().length, 22);
		assertEquals(id("test_").length, 27);
		assertNotEquals(id(), id());
	});
	await t.step("isID", () => {
		assertEquals(isID(id()), true);
		assertEquals(isID("test_", id("test_")), true);
		assertEquals(isID("test_", id()), false);
		assertEquals(isID("..."), false);
		assertEquals(isID("test_", ""), false);
	});
	await t.step("assertID", () => {
		assertID(id());
		assertID("test_", id("test_"));
		assertThrows(() => assertID("..."));
		assertThrows(() => assertID("test_", id()));
		assertThrows(() => assertID("test_", ""));
	});
	await t.step("ksuid", () => {
		assertEquals(ksuid(0).length, 32);
		assertEquals(ksuid("test_", 0).length, 37);
		assertNotEquals(ksuid(0), ksuid(0));
		assertID(ksuid(0));
		assert(ksuid(0) < ksuid(1));
	});
	await t.step("rksuid", () => {
		assertEquals(rksuid(0).length, 32);
		assertEquals(rksuid("test_", 0).length, 37);
		assertNotEquals(rksuid(0), rksuid(0));
		assertID(rksuid(0));
		assert(rksuid(0) > rksuid(1));
	});
	await t.step("typebox schema", () => {
		const usrIDSchema = ID("usr_");
		assert(Value.Check(usrIDSchema, id("usr_")));
		assert(!Value.Check(usrIDSchema, id("foo_")));
	});
});
