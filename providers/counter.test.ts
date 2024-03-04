import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import type { CounterProvider } from "./counter.ts";

export default async function testCounterProvider(
	cp: CounterProvider,
	t: Deno.TestContext,
): Promise<void> {
	await t.step("increment without expiration", async () => {
		assertEquals(await cp.increment(["insc"], 0), 0);
		assertEquals(await cp.increment(["insc"], 1), 1);
		assertEquals(await cp.increment(["insc"], 1), 2);
		assertEquals(await cp.increment(["insc"], 2), 4);
	});

	await t.step("increment with expiration", async () => {
		assertEquals(await cp.increment(["insc-expire"], 1, 100), 1);
		await new Promise((r) => setTimeout(r, 1000));
		assertEquals(await cp.increment(["insc-expire"], 1), 1);
	});

	await t.step("reset", async () => {
		assertEquals(await cp.increment(["reset"], 1), 1);
		assertEquals(await cp.increment(["reset"], 1), 2);
		await cp.reset(["reset"]);
		assertEquals(await cp.increment(["reset"], 0), 0);
	});
}
