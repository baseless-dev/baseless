import { RateLimiterProvider, type RateLimiterProviderLimitOptions } from "@baseless/server";
import { LruCache } from "./lru_cache.ts";

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
		const meta = this.#storage.get(key) ?? { count: 0, expireAt: Date.now() + period };
		if (meta.expireAt < Date.now()) {
			meta.count = 0;
			meta.expireAt = Date.now() + period;
		}
		meta.count++;
		this.#storage.put(key, meta);
		return Promise.resolve(meta.count <= limit);
	}
}
