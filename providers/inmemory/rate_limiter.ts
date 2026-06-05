import { RateLimiterProvider, type RateLimiterProviderLimitOptions } from "@baseless/server";
import { LruCache } from "./lru_cache.ts";
import tracer from "./tracer.ts";

interface KeyMetadata {
	count: number;
	expireAt: number;
}

/**
 * In-memory implementation of {@link RateLimiterProvider}.
 *
 * Tracks request counts per key using an {@link LruCache} so that memory
 * usage is bounded.  Suitable for unit tests and single-process servers;
 * does not share state across multiple processes.
 */
export class MemoryRateLimiterProvider extends RateLimiterProvider {
	#storage: LruCache<string, KeyMetadata>;

	constructor(maxSize = 2000) {
		super();
		this.#storage = new LruCache<string, KeyMetadata>(maxSize);
	}

	limit({ key, limit, period }: RateLimiterProviderLimitOptions): Promise<boolean> {
		return tracer.startActiveSpan("@baseless/inmemory-provider.ratelimiter.limit", async (span) => {
			span.setAttribute("ratelimiter.key", key);
			span.setAttribute("ratelimiter.limit", limit);
			span.setAttribute("ratelimiter.period", period);
			try {
				const meta = this.#storage.get(key) ?? { count: 0, expireAt: Date.now() + period };
				if (meta.expireAt < Date.now()) {
					meta.count = 0;
					meta.expireAt = Date.now() + period;
				}
				meta.count++;
				this.#storage.put(key, meta);
				return Promise.resolve(meta.count <= limit);
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
