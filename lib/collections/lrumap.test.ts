import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { LRUMap } from "./lrumap.ts";

Deno.test("LRUMap", async (t) => {
	await t.step("set/get/has/delete/clear", () => {
		const map = new LRUMap(2);
		map.set("a", "1");
		map.set("b", "2");
		map.set("c", "3");
		assertEquals(map.get("a"), undefined);
		assertEquals(map.get("b"), "2");
		assertEquals(map.get("c"), "3");
		assertEquals(map.get("d"), undefined);
		assertEquals(map.has("b"), true);
		assertEquals(map.has("d"), false);
		assertEquals(map.delete("b"), true);
		assertEquals(map.delete("d"), false);
		assertEquals(map.has("b"), false);
		map.clear();
		assertEquals(map.has("b"), false);
		assertEquals(map.has("c"), false);
	});
	await t.step("keys/values/entries/forEach", () => {
		const map = new LRUMap(2);
		map.set("c", "3");
		map.set("b", "2");
		map.set("a", "1");
		assertEquals(Array.from(map.keys()), ["b", "a"]);
		assertEquals(Array.from(map.values()), ["2", "1"]);
		assertEquals(Array.from(map.entries()), [["b", "2"], ["a", "1"]]);
		assertEquals(Array.from(map), [["b", "2"], ["a", "1"]]);
		const entries: Array<[string, unknown]> = [];
		map.forEach((value, key) => {
			entries.push([key, value] as const);
		});
		assertEquals(entries, [["b", "2"], ["a", "1"]]);
	});
});
