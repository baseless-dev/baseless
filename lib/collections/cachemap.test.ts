import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { CacheMap } from "./cachemap.ts";

Deno.test("CacheMap", async (t) => {
	await t.step("set/get/has/delete/clear", async () => {
		const map = new CacheMap();
		map.set("a", "1");
		map.set("b", "2");
		map.set("c", "3", 100);
		assertEquals(map.get("a"), "1");
		assertEquals(map.get("b"), "2");
		assertEquals(map.get("c"), "3");
		assertEquals(map.get("d"), undefined);
		assertEquals(map.has("a"), true);
		assertEquals(map.has("d"), false);
		assertEquals(map.delete("a"), true);
		assertEquals(map.delete("d"), false);
		assertEquals(map.has("a"), false);
		await new Promise((r) => setTimeout(r, 150));
		assertEquals(map.has("c"), false);
		map.clear();
		assertEquals(map.has("b"), false);
	});
	await t.step("keys/values/entries/forEach", () => {
		const map = new CacheMap();
		map.set("c", "3");
		map.set("b", "2");
		map.set("a", "1");
		assertEquals(Array.from(map.keys()), ["a", "b", "c"]);
		assertEquals(Array.from(map.values()), ["1", "2", "3"]);
		assertEquals(Array.from(map.entries()), [["a", "1"], ["b", "2"], [
			"c",
			"3",
		]]);
		assertEquals(Array.from(map), [["a", "1"], ["b", "2"], ["c", "3"]]);
		const entries: Array<[string, unknown]> = [];
		map.forEach((value, key) => {
			entries.push([key, value] as const);
		});
		assertEquals(entries, [["a", "1"], ["b", "2"], ["c", "3"]]);
	});
});
