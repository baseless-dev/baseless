import { assert } from "@std/assert/assert";
import { verify, work, WorkAbortedError } from "./pow.ts";

Deno.test("Proof-of-Work", async (ctx) => {
	await ctx.step("verify", async () => {
		assert(await verify("hello", 20, 4255646));
	});

	await ctx.step("work", async () => {
		const nonce = await work("hello", 1);
		assert(await verify("hello", 1, nonce));
	});

	// await ctx.step("difficulty", async () => {
	// 	const challenge = "hello";
	// 	for (let i = 1; i <= 20; ++i) {
	// 		console.time(`difficulty=${i}`);
	// 		const nonce = await work(challenge, i, { threads: 4 });
	// 		console.timeEnd(`difficulty=${i}`);
	// 		console.log(nonce);
	// 	}
	// });

	await ctx.step("cancel single threaded work", async () => {
		const result = await work("impossible", 32, { signal: AbortSignal.timeout(200) }).catch((e) => e);
		assert(result instanceof WorkAbortedError);
	});

	await ctx.step("cancel multi threaded work", async () => {
		const result = await work("impossible", 32, { threads: 2, signal: AbortSignal.timeout(200) }).catch((e) => e);
		assert(result instanceof WorkAbortedError);
	});
});
