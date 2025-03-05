import { assert, assertThrows } from "@std/assert";
import { id } from "./id.ts";
import { Identity } from "./identity.ts";
import * as Type from "./schema.ts";

Deno.test("Identity", async (t) => {
	await t.step("specification", () => {
		assert(Type.validate(Identity, { id: id("id_"), data: {} }));
		assert(!Type.validate(Identity, { id: id("id_") }));
		assert(!Type.validate(Identity, "foo"));
	});
});
