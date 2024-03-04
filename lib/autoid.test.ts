import { assert } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { ksuid, rksuid, ruid, suid } from "./autoid.ts";

Deno.test("AutoID", async (t) => {
	await t.step("ruid", () => {
		assert(ruid().length === 22);
		assert(ruid() !== ruid());
	});

	await t.step("suid", () => {
		assert(suid("foobar").length === 22);
		assert(suid("foobar") === suid("foobar"));
	});

	await t.step("ksuid", () => {
		assert(ksuid().length === 30);
		assert(ksuid() !== ksuid());
	});

	await t.step("rksuid", () => {
		assert(rksuid().length === 30);
		assert(rksuid() !== rksuid());
	});
});
