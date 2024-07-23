import { assert, assertEquals, assertThrows } from "@std/assert";
import { id } from "./id.ts";
import { assertIdentity, Identity, isIdentity } from "./identity.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("Identity", async (t) => {
	await t.step("isIdentity", () => {
		assert(isIdentity({ identityId: id("id_"), data: {} }));
		assert(isIdentity({ identityId: id("id_") }));
		assert(!isIdentity("foo"));
	});
	await t.step("assertIdentity", () => {
		assertIdentity({ identityId: id("id_"), data: {} });
		assertIdentity({ identityId: id("id_") });
		assertThrows(() => assertIdentity("foo"));
	});
	await t.step("typebox schema", () => {
		assert(Value.Check(Identity(), { identityId: id("id_"), data: {} }));
		assert(Value.Check(Identity(), { identityId: id("id_") }));
		assert(!Value.Check(Identity(), "foo"));
	});
});
