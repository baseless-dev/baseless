import { testRateLimiterProvider } from "../../server/provider.test.ts";
import { MemoryRateLimiterProvider } from "./rate_limiter.ts";

Deno.test("MemoryRateLimiterProvider", async (t) => {
	const provider = new MemoryRateLimiterProvider();
	await testRateLimiterProvider(provider, t);
});
