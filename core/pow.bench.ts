import { verify, work } from "./pow.ts";

Deno.bench("verify", async () => {
	await verify("hello", 20, 4255646);
});

Deno.bench("work (blocking)", async () => {
	await work("hello", 12);
});

Deno.bench("work (non-blocking)", async () => {
	await work("hello", 12, { threads: 1 });
});

Deno.bench("work (multi threaded)", async () => {
	await work("hello", 12, { threads: 4 });
});
