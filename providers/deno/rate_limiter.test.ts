import { testRateLimiterProvider } from "../../server/provider.test.ts";
import { DenoRateLimiterProvider } from "./rate_limiter.ts";

Deno.test("DenoRateLimiterProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const provider = new DenoRateLimiterProvider(denokv);
	await testRateLimiterProvider(provider, t);
	denokv.close();
});
