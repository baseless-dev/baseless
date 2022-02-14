import { IKVProvider, KVScanFilter, KVSetOptions } from "https://baseless.dev/x/provider/kv.ts";
import { IKVValue, KeyNotFoundError, KVData } from "https://baseless.dev/x/shared/kv.ts";
import { logger } from "https://baseless.dev/x/logger/mod.ts";
import "./cloudflare-workers.d.ts";

export class CloudflareKVValue<Metadata> implements IKVValue<Metadata> {
	public constructor(
		public key: string,
		public metadata: Metadata,
		protected _data: KVData,
	) {}

	public data(): Promise<KVData> {
		return Promise.resolve(this._data);
	}
}

export class CloudflareKVListValue<Metadata> implements IKVValue<Metadata> {
	protected cachedData: KVData | undefined;

	public constructor(
		public key: string,
		public metadata: Metadata,
		protected ns: KVNamespace,
	) {}

	public data(): Promise<KVData> {
		return this.cachedData !== undefined
			? Promise.resolve(this.cachedData)
			: this.ns.get(this.key, "stream").then((data) => {
				this.cachedData = data;
				return data;
			});
	}
}

export class CloudflareKVProvider implements IKVProvider {
	protected logger = logger("provider-kv-cloudflarekv");

	constructor(protected ns: KVNamespace) {}

	public open(): Promise<void> {
		return Promise.resolve();
	}

	public close(): Promise<void> {
		return Promise.resolve();
	}

	public get<Metadata>(key: string): Promise<IKVValue<Metadata>> {
		return this.ns
			.getWithMetadata(key, "stream")
			.catch(() => {
				throw new KeyNotFoundError(key);
			})
			.then(({ metadata, value }) => new CloudflareKVValue(key, metadata as Metadata, value as KVData));
	}

	public list<Metadata>(
		prefix: string,
		filter?: KVScanFilter<Metadata>,
	): Promise<IKVValue<Metadata>[]> {
		return this.ns
			.list({ prefix })
			.then(({ keys }) =>
				keys.map((key) =>
					new CloudflareKVListValue(
						key.name,
						(key.metadata ?? {}) as Metadata,
						this.ns,
					)
				)
			)
			.then((results) => {
				if (filter) {
					// deno-lint-ignore no-explicit-any
					const filterFns: ((doc: any) => boolean)[] = [];
					for (const key of Object.keys(filter)) {
						const prop = key as keyof Metadata;
						const op = filter[prop];
						if ("eq" in op) {
							filterFns.push((doc) => doc[prop] == op["eq"]);
						} else if ("neq" in op) {
							filterFns.push((doc) => doc[prop] != op["neq"]);
						} else if ("gt" in op) {
							filterFns.push((doc) => doc[prop] > op["gt"]);
						} else if ("gte" in op) {
							filterFns.push((doc) => doc[prop] >= op["gte"]);
						} else if ("lt" in op) {
							filterFns.push((doc) => doc[prop] < op["lt"]);
						} else if ("lte" in op) {
							filterFns.push((doc) => doc[prop] != op["lte"]);
						} else if ("in" in op) {
							filterFns.push((doc) => op["in"].includes(doc[prop]));
						} else if ("nin" in op) {
							filterFns.push((doc) => !op["nin"].includes(doc[prop]));
						}
					}
					results = results.filter((doc) => filterFns.every((fn) => fn(doc.metadata)));
				}
				return results;
			});
	}

	public set<Metadata>(
		key: string,
		metadata: Metadata,
		data?: KVData,
		options?: KVSetOptions,
	): Promise<void> {
		const kvoptions: KVNamespacePutOptions = options
			? "expireAt" in options ? { expiration: options.expireAt.getTime() / 1000 } : { expirationTtl: options.expireIn }
			: {};
		return this.ns.put(key, data ?? "", {
			metadata,
			...kvoptions,
		});
	}

	public delete(key: string): Promise<void> {
		return this.ns.delete(key);
	}
}
