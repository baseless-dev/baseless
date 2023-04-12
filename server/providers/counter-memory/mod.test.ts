import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { MemoryCounterProvider } from "./mod.ts";

Deno.test("increment without expiration", async () => {
	const counter = new MemoryCounterProvider();
	assertEquals(await counter.increment("a", 0), 0);
	assertEquals(await counter.increment("a", 1), 1);
	assertEquals(await counter.increment("a", 1), 2);
	assertEquals(await counter.increment("a", -1), 1);
});

Deno.test("increment with expiration", async () => {
	const counter = new MemoryCounterProvider();
	assertEquals(await counter.increment("a", 1, 100), 1);
	await new Promise((r) => setTimeout(r, 1000));
	assertEquals(await counter.increment("a", 1), 1);
});

Deno.test("reset", async () => {
	const counter = new MemoryCounterProvider();
	assertEquals(await counter.increment("a", 1), 1);
	assertEquals(await counter.increment("a", 1), 2);
	await counter.reset("a");
	assertEquals(await counter.increment("a", 0), 0);
});
