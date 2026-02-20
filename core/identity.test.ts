import { assertThrows } from "@std/assert";
import { id } from "./id.ts";
import { Identity } from "./identity.ts";
import * as z from "./schema.ts";

Deno.test("Identity", async (t) => {
	await t.step("specification", () => {
		Identity.parse({ id: id("id_"), data: {} });
		assertThrows(() => Identity.parse({ id: id("id_") }));
		assertThrows(() => Identity.parse("foo"));
	});
});
