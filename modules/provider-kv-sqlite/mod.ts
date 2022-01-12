import {
	IKVProvider,
	KVScanFilter,
	KVSetOptions,
} from "https://baseless.dev/x/provider/deno/kv.ts";
import {
	IKVValue,
	KeyNotFoundError,
	KVData,
} from "https://baseless.dev/x/shared/deno/kv.ts";
import { DB, SqliteOptions } from "https://deno.land/x/sqlite@v3.2.0/mod.ts";
import { getLogger } from "https://deno.land/std@0.118.0/log/mod.ts";

export class SqliteNotOpenedError extends Error {
	public name = "SqliteNotOpenedError";
}

export class SqliteUnknownError extends Error {
	public name = "SqliteUnknownError";
	public constructor(public inner: Error) {
		super(inner.cause);
	}
}

export class SqliteValue<Metadata> implements IKVValue<Metadata> {
	public constructor(
		public key: string,
		public metadata: Metadata,
		protected _data: KVData,
	) {}

	public data(): Promise<KVData> {
		return Promise.resolve(this._data);
	}
}

export type SqliteKVProviderOptions = {
	path: string;
	mode: SqliteOptions["mode"];
} | {
	db: DB;
};

export class SqliteKVProvider implements IKVProvider {
	protected options: SqliteKVProviderOptions;
	protected db?: DB;
	protected logger = getLogger("baseless-kv-sqlite");

	constructor(db: DB);
	constructor(path: string, mode?: SqliteOptions["mode"]);
	constructor(
		path_or_db: DB | string,
		mode: SqliteOptions["mode"] = "write",
	) {
		if (path_or_db instanceof DB) {
			this.options = { db: path_or_db };
		} else {
			this.options = { path: path_or_db, mode };
		}
	}

	// deno-lint-ignore require-await
	public async open(): Promise<void> {
		if ("db" in this.options) {
			return;
		}
		const db = this.options.path === ":memory:"
			? new DB(undefined, { mode: this.options.mode, memory: true })
			: new DB(this.options.path, { mode: this.options.mode });
		try {
			db.query(
				"CREATE TABLE IF NOT EXISTS kv (key TEXT NOT NULL PRIMARY KEY, expireAt INTEGER, metadata TEXT NOT NULL, data TEXT) WITHOUT ROWID",
			);
			this.logger.debug(`Database initialized.`);
			this.db = db;
		} catch (_err) {
			this.logger.error(`Could not create base table "kv".`);
			throw new SqliteNotOpenedError();
		}
	}

	// deno-lint-ignore require-await
	public async close(): Promise<void> {
		if ("db" in this.options) {
			this.db = undefined;
		} else if (this.db) {
			try {
				this.db.close();
				this.logger.debug(`Database closed.`);
				this.db = undefined;
			} catch (err) {
				this.logger.error(`Could not close the database.`);
				throw new SqliteUnknownError(err);
			}
		}
	}

	// deno-lint-ignore require-await
	public async get<Metadata>(key: string): Promise<IKVValue<Metadata>> {
		if (!this.db) {
			throw new SqliteNotOpenedError();
		}
		const now = new Date().getTime() / 1000;
		try {
			const rows = this.db.query<[string, string]>(
				"SELECT metadata, data FROM kv WHERE key = ? AND (expireAt IS NULL OR expireAt >= ?) LIMIT 1",
				[key, now],
			);
			if (rows.length === 0) {
				this.logger.debug(`Key "${key}" does not exists.`);
				throw new KeyNotFoundError(key);
			}
			return new SqliteValue(
				key,
				JSON.parse(rows[0][0]),
				JSON.parse(rows[0][1]),
			);
		} catch (err) {
			if (err instanceof KeyNotFoundError) {
				throw err;
			}
			this.logger.error(
				`Could not retrieve key "${key}", got error : ${err}`,
			);
			throw new SqliteUnknownError(err);
		}
	}

	// deno-lint-ignore require-await
	public async list<Metadata>(
		prefix: string,
		filter?: KVScanFilter<Metadata>,
	): Promise<IKVValue<Metadata>[]> {
		if (!this.db) {
			throw new SqliteNotOpenedError();
		}

		const prefixMatch = `${prefix}%`;
		const now = new Date().getTime() / 1000;
		try {
			const rows = this.db.query<[string, string, string]>(
				"SELECT key, metadata, data FROM kv WHERE key LIKE ? AND (expireAt IS NULL OR expireAt >= ?) ORDER BY key ASC",
				[prefixMatch, now],
			);
			this.logger.debug(
				`Found ${rows.length} keys with prefix "${prefix}".`,
			);
			const values = rows.map(
				(row) =>
					new SqliteValue(
						row[0],
						JSON.parse(row[1]),
						row[2],
					),
			);
			if (filter) {
				// deno-lint-ignore no-explicit-any
				const filterFns: ((row: any) => boolean)[] = [];
				for (const key of Object.keys(filter)) {
					const prop = key as keyof Metadata;
					const op = filter[prop];
					if ("eq" in op) {
						filterFns.push((row) => row[prop] == op["eq"]);
					} else if ("neq" in op) {
						filterFns.push((row) => row[prop] != op["neq"]);
					} else if ("gt" in op) {
						filterFns.push((row) => row[prop] > op["gt"]);
					} else if ("gte" in op) {
						filterFns.push((row) => row[prop] >= op["gte"]);
					} else if ("lt" in op) {
						filterFns.push((row) => row[prop] < op["lt"]);
					} else if ("lte" in op) {
						filterFns.push((row) => row[prop] != op["lte"]);
					} else if ("in" in op) {
						filterFns.push((row) => op["in"].includes(row[prop]));
					} else if ("nin" in op) {
						filterFns.push((row) => !op["nin"].includes(row[prop]));
					}
				}
				return values.filter((row) =>
					filterFns.every((fn) => fn(row.metadata))
				);
			}
			return values;
		} catch (err) {
			this.logger.error(
				`Could not list prefix "${prefix}", got error : ${err}`,
			);
			throw new SqliteUnknownError(err);
		}
	}

	public async set<Metadata>(
		key: string,
		metadata: Metadata,
		data?: KVData,
		options?: KVSetOptions,
	): Promise<void> {
		if (!this.db) {
			throw new SqliteNotOpenedError();
		}
		const expireAt = options
			? "expireAt" in options
				? options.expireAt.getTime() / 1000
				: options.expireIn + new Date().getTime() / 1000
			: null;
		try {
			if (data instanceof ReadableStream) {
				data = await new Response(data).arrayBuffer();
			}
			if (data instanceof ArrayBuffer) {
				data = new Uint8Array(data);
			}
			this.db.query(
				"INSERT OR REPLACE INTO kv (key, expireAt, metadata, data) VALUES (?, ?, ?, ?)",
				[
					key,
					expireAt,
					JSON.stringify(metadata ?? {}),
					data as null | string | Uint8Array,
				],
			);
			this.logger.debug(`Key "${key}" set.`);
		} catch (err) {
			this.logger.error(`Could not set key "${key}", got error : ${err}`);
			throw new SqliteUnknownError(err);
		}
	}

	// deno-lint-ignore require-await
	public async delete(key: string): Promise<void> {
		if (!this.db) {
			throw new SqliteNotOpenedError();
		}
		try {
			this.db.query("DELETE FROM kv WHERE key = ?", [key]);
			this.logger.debug(`Key "${key}" deleted.`);
		} catch (err) {
			this.logger.error(`Could not delete key "${key}", got error : ${err}`);
			throw new SqliteUnknownError(err);
		}
	}
}
