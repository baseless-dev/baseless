import { assert } from "@std/assert/assert";
import { verify, work, WorkAbortedError } from "./pow.ts";

Deno.test("Proof-of-Work", async (ctx) => {
	await ctx.step("verify", async () => {
		assert(await verify("hello", 4, 16113));
	});

	await ctx.step("work", async () => {
		const nonce = await work("hello", 1);
		assert(await verify("hello", 1, nonce));
	});

	// await ctx.step("difficulty", async () => {
	// 	const challenge = "hello";
	// 	for (let i = 1; i <= 6; ++i) {
	// 		console.time(`difficulty=${i}`);
	// 		const nonce = await work(challenge, i, { threads: 1 });
	// 		console.timeEnd(`difficulty=${i}`);
	// 		console.log(nonce);
	// 	}
	// });

	await ctx.step("cancel single threaded work", async () => {
		const abortController = new AbortController();
		setTimeout(() => abortController.abort(), 200);
		const result = await work("impossible", 32, { signal: abortController.signal }).catch((e) => e);
		assert(result instanceof WorkAbortedError);
	});

	await ctx.step("cancel multi threaded work", async () => {
		const abortController = new AbortController();
		setTimeout(() => abortController.abort(), 200);
		const result = await work("impossible", 32, { threads: 2, signal: abortController.signal }).catch((e) => e);
		assert(result instanceof WorkAbortedError);
	});
});
