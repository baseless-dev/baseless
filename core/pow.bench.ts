import { verify, work } from "./pow.ts";

Deno.bench("verify", async () => {
	await verify("hello", 4, 16113);
});

Deno.bench("work (single threaded)", async () => {
	await work("hello", 3);
});

Deno.bench("work (multi threaded)", async () => {
	await work("hello", 4, { threads: 16 });
});
