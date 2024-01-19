import type {
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVPutOptions,
} from "../../providers/kv.ts";
import type {
	// deno-lint-ignore no-unused-vars
	KVKeyNotFoundError,
	// deno-lint-ignore no-unused-vars
	KVPutError,
} from "../kv/errors.ts";

export interface IKVService {
	/**
	 * @throws {KVKeyNotFoundError}
	 */
	get(
		key: string[],
		options?: KVGetOptions,
	): Promise<KVKey>;

	/**
	 * @throws {KVPutError}
	 */
	put(
		key: string[],
		value: string,
		options?: KVPutOptions,
	): Promise<void>;

	list(options: KVListOptions): Promise<KVListResult>;

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	delete(key: string[]): Promise<void>;
}
