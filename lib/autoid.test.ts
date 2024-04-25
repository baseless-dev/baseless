import { assert } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { isAutoId, ksuid, rksuid, ruid } from "./autoid.ts";
import { assertEquals } from "https://deno.land/std@0.213.0/assert/assert_equals.ts";

Deno.test("AutoID", async (t) => {
	await t.step("ruid", () => {
		assertEquals(ruid().length, 20);
		assert(ruid() !== ruid());
	});

	await t.step("ksuid", () => {
		assertEquals(ksuid().length, 30);
		assert(ksuid() !== ksuid());
		const a = ksuid("", 1);
		const b = ksuid("", 2);
		assert(a < b);
		assert(a.localeCompare(b) < 0);
	});

	await t.step("rksuid", () => {
		assert(rksuid().length === 30);
		assert(rksuid() !== rksuid());
		const a = rksuid("", 1);
		const b = rksuid("", 2);
		assert(a > b);
		assert(a.localeCompare(b) > 0);
	});

	await t.step("isAutoId", () => {
		assert(isAutoId(ruid()));
		assert(isAutoId(ksuid()));
		assert(isAutoId(rksuid()));
	});
});
