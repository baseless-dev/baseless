import { RateLimiterProvider, type RateLimiterProviderLimitOptions } from "@baseless/server";

interface KeyMetadata {
	count: number;
	expireAt: number;
}

export class DenoRateLimiterProvider extends RateLimiterProvider {
	#storage: Deno.Kv;

	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

	async limit(options: RateLimiterProviderLimitOptions): Promise<boolean> {
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
	}
}
