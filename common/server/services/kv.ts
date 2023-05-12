import type {
	KVGetOptions,
	KVKey,
	KVListOptions,
	KVListResult,
	KVPutOptions,
} from "../../../providers/kv.ts";
// deno-lint-ignore no-unused-vars
import type {
	KVKeyNotFoundError,
	KVPutError,
} from "../../../common/kv/errors.ts";

export interface IKVService {
	/**
	 * @throws {KVKeyNotFoundError}
	 */
	get(
		key: string,
		options?: KVGetOptions,
	): Promise<KVKey>;

	/**
	 * @throws {KVPutError}
	 */
	put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): Promise<void>;

	list(options: KVListOptions): Promise<KVListResult>;

	/**
	 * @throws {KVKeyNotFoundError}
	 */
	delete(key: string): Promise<void>;
}
