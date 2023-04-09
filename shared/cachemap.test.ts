import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { CacheMap } from "./cachemap.ts";

Deno.test("set", () => {
	const map = new CacheMap();
	map.set("a", 0);
	map.set("a", 0, 60);
	map.set("a", 0, new Date(Date.now() + 60_000));
});

Deno.test("get", async () => {
	const map = new CacheMap();
	map.set("a", 1);
	assertEquals(map.get("a"), 1);
	assertEquals(map.get("b"), undefined);
	map.set("c", 1, 100);
	await new Promise((r) => setTimeout(r, 1000));
	assertEquals(map.get("c"), undefined);
});
