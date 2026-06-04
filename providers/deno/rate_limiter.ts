import { RateLimiterProvider, type RateLimiterProviderLimitOptions } from "@baseless/server";
import tracer from "./tracer.ts";

interface KeyMetadata {
	count: number;
	expireAt: number;
}

/**
 * Deno KV-backed implementation of {@link RateLimiterProvider}.
 *
 * Uses atomic counters stored in a {@link Deno.Kv} database to enforce
 * sliding-window rate limits.
 */
export class DenoRateLimiterProvider extends RateLimiterProvider {
	#storage: Deno.Kv;

	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

	/**
	 * Checks whether the request identified by `options.key` is within the
	 * allowed rate limit using an atomic counter in Deno KV.
	 * @param options Limit options including key, limit, and period.
	 * @returns `true` if the request is allowed, `false` if the limit is exceeded.
	 */
	async limit(options: RateLimiterProviderLimitOptions): Promise<boolean> {
		return tracer.startActiveSpan("@baseless/deno-provider.ratelimiter.limit", async (span) => {
			span.setAttribute("ratelimiter.key", options.key);
			span.setAttribute("ratelimiter.limit", options.limit);
			span.setAttribute("ratelimiter.period", options.period);
			try {
				const expireIn = Date.now() + options.period;
				const window = (expireIn / options.period) >> 0;
				const key = [options.key, window];
				await this.#storage.atomic()
					.check({ key, versionstamp: null })
					.set(key, new Deno.KvU64(0n), { expireIn })
					.commit()
					.catch((_) => {});
				await this.#storage.atomic()
					.sum(key, 1n)
					.commit();
				const result = await this.#storage.get<bigint>(key, { consistency: "strong" });
				return !!result.value && result.value <= options.limit;
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}
}
