import { MemoryCounterProvider } from "./mod.ts";
import testCounterProvider from "../../server/providers/counter.test.ts";

Deno.test("MemoryCounterProvider", async (t) => {
	const cp = new MemoryCounterProvider();
	await testCounterProvider(cp, t);
});
