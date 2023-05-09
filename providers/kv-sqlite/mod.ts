import { DB, SqliteOptions } from "https://deno.land/x/sqlite@v3.4.1/mod.ts";
import {
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVProvider,
	KVPutOptions,
} from "../kv.ts";
import { createLogger } from "../../common/system/logger.ts";
import { KVKeyNotFoundError, KVPutError } from "../../common/kv/errors.ts";

export type SqliteKVProviderOptions = {
	readonly path: string;
	readonly tableName: string;
	readonly mode: SqliteOptions["mode"];
} | {
	readonly db: DB;
	readonly tableName: string;
};

export class SqliteKVProvider implements KVProvider {
	#options: SqliteKVProviderOptions;
	#logger = createLogger("baseless-kv-sqlite");
	protected db?: DB;

	constructor(db: DB, tableName?: string);
	constructor(path: string, tableName?: string, mode?: SqliteOptions["mode"]);
	constructor(
		path_or_db: DB | string,
		tableName = "kv",
		mode: SqliteOptions["mode"] = "create",
	) {
		if (path_or_db instanceof DB) {
			this.#options = { db: path_or_db, tableName };
		} else {
			this.#options = { path: path_or_db, tableName, mode };
		}
	}

	/**
	 * Open a handle to the SQLite database
	 * @throws {SqliteNotOpenedError}
	 */
	// deno-lint-ignore require-await
	public async open(): Promise<void> {
		if ("db" in this.#options) {
			throw new SqliteNotOpenedError();
		}
		try {
			const db = this.#options.path === ":memory:"
				? new DB(undefined, { mode: this.#options.mode, memory: true })
				: new DB(this.#options.path, { mode: this.#options.mode });
			db.query(
				`CREATE TABLE IF NOT EXISTS ${this.#options.tableName} (key TEXT NOT NULL PRIMARY KEY, expireAt INTEGER, value TEXT) WITHOUT ROWID`,
			);
			this.#logger.debug(`Database initialized.`);
			this.db = db;
		} catch (_inner) {
			this.#logger.error(
				`Could not create base table '${this.#options.tableName}'.`,
			);
			throw new SqliteNotOpenedError();
		}
	}

	/**
	 * Close the handle to the SQLite database
	 * @throws {SqliteUnknownError}
	 */
	// deno-lint-ignore require-await
	public async close(): Promise<void> {
		if ("db" in this.#options) {
			this.db = undefined;
		} else if (this.db) {
			try {
				this.db.close();
				this.#logger.debug(`Database closed.`);
				this.db = undefined;
			} catch (_inner) {
				this.#logger.error(`Could not close the database.`);
				throw new SqliteUnknownError();
			}
		}
	}

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	// deno-lint-ignore require-await
	async get(
		key: string,
		_options?: KVGetOptions,
	): Promise<KVKey> {
		if (!this.db) {
			throw new KVKeyNotFoundError();
		}
		const now = new Date().getTime();
		try {
			const rows = this.db.query<[string, number]>(
				`SELECT value, expireAt FROM ${this.#options.tableName} WHERE key = ? AND (expireAt IS NULL OR expireAt >= ?) LIMIT 1`,
				[key, now],
			);
			if (rows.length === 0) {
				this.#logger.debug(`Key "${key}" does not exists.`);
				throw new KVKeyNotFoundError();
			}
			return {
				key,
				expiration: rows[0][1] ?? undefined,
				value: rows[0][0],
			};
		} catch (inner) {
			this.#logger.error(
				`Could not retrieve key "${key}", got error : ${inner}`,
			);
		}
		throw new KVKeyNotFoundError();
	}

	/**
	 * @throws {KVPutError}
	 */
	// deno-lint-ignore require-await
	async put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): Promise<void> {
		if (this.db) {
			const expireAt = options?.expiration
				? options.expiration instanceof Date
					? options.expiration.getTime()
					: options.expiration + new Date().getTime()
				: null;
			try {
				this.db.query(
					`INSERT OR REPLACE INTO ${this.#options.tableName} (key, expireAt, value) VALUES (?, ?, ?)`,
					[
						key,
						expireAt,
						value,
					],
				);
				this.#logger.debug(`Key "${key}" set.`);
				return;
			} catch (inner) {
				this.#logger.error(`Could not set key "${key}", got error : ${inner}`);
			}
		}
		throw new KVPutError();
	}

	// deno-lint-ignore require-await
	async list(
		{ prefix, cursor = "", limit = 10 }: KVListOptions,
	): Promise<KVListResult> {
		if (this.db) {
			const prefixMatch = `${prefix}%`;
			const now = new Date().getTime();
			try {
				const rows = this.db.query<[string, string, number]>(
					`SELECT key, value, expireAt FROM ${this.#options.tableName} WHERE key LIKE ? AND (expireAt IS NULL OR expireAt >= ?) AND key > ? ORDER BY key ASC LIMIT ?`,
					[prefixMatch, now, cursor, limit],
				);
				this.#logger.debug(
					`Found ${rows.length} keys with prefix "${prefix}".`,
				);
				const keys = rows.map(
					(row) => ({
						key: row[0],
						value: row[1],
						expiration: row[2] ?? undefined,
					}),
				);
				const done = keys.length !== limit;
				return {
					keys: keys as unknown as ReadonlyArray<KVKey>,
					done,
					next: done ? undefined : keys[keys.length - 1]?.key,
				};
			} catch (inner) {
				this.#logger.error(
					`Could not list prefix "${prefix}", got error : ${inner}`,
				);
			}
		}
		return {
			done: true,
			keys: [],
			next: undefined,
		};
	}

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	// deno-lint-ignore require-await
	async delete(key: string): Promise<void> {
		if (this.db) {
			try {
				this.db.query(`DELETE FROM ${this.#options.tableName} WHERE key = ?`, [
					key,
				]);
				this.#logger.debug(`Key "${key}" deleted.`);
				return;
			} catch (inner) {
				this.#logger.error(
					`Could not delete key "${key}", got error : ${inner}`,
				);
			}
		}
		throw new KVKeyNotFoundError();
	}

	/**
	 * Delete expired keys
	 * @throws {SqliteNotOpenedError}
	 */
	// deno-lint-ignore require-await
	async deleteExpiredKeys(): Promise<void> {
		if (!this.db) {
			throw new SqliteNotOpenedError();
		}
		const now = new Date().getTime();
		try {
			this.db.query(
				`DELETE FROM ${this.#options.tableName} WHERE (expireAt IS NOT NULL AND expireAt < ?)`,
				[now],
			);
			this.#logger.debug(`Expired keys deleted.`);
		} catch (inner) {
			this.#logger.error(`Could not delete expired keys, got error : ${inner}`);
			throw new SqliteNotOpenedError();
		}
	}
}

export class SqliteNotOpenedError extends Error {}
export class SqliteUnknownError extends Error {}
