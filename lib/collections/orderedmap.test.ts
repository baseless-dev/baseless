import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { OrderedMap } from "./orderedmap.ts";

Deno.test("OrderedMap", async (t) => {
	await t.step("set/get/has/delete/clear", () => {
		const map = new OrderedMap();
		map.set("a", "1");
		map.set("b", "2");
		map.set("c", "3");
		assertEquals(map.get("a"), "1");
		assertEquals(map.get("b"), "2");
		assertEquals(map.get("c"), "3");
		assertEquals(map.get("d"), undefined);
		assertEquals(map.has("a"), true);
		assertEquals(map.has("d"), false);
		assertEquals(map.delete("a"), true);
		assertEquals(map.delete("d"), false);
		assertEquals(map.has("a"), false);
		map.clear();
		assertEquals(map.has("b"), false);
		assertEquals(map.has("c"), false);
	});
	await t.step("keys/values/entries/forEach", () => {
		const map = new OrderedMap();
		map.set("c", "3");
		map.set("b", "2");
		map.set("a", "1");
		assertEquals(Array.from(map.keys()), ["a", "b", "c"]);
		assertEquals(Array.from(map.values()), ["1", "2", "3"]);
		assertEquals(Array.from(map.entries()), [["a", "1"], ["b", "2"], ["c", "3"]]);
		assertEquals(Array.from(map), [["a", "1"], ["b", "2"], ["c", "3"]]);
		const entries: Array<[string, unknown]> = [];
		map.forEach((value, key) => {
			entries.push([key, value] as const);
		});
		assertEquals(entries, [["a", "1"], ["b", "2"], ["c", "3"]]);
	});
});