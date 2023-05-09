export class KVKeyNotFoundError extends Error {
	name = "KVKeyNotFoundError" as const;
}
export class KVPutError extends Error {
	name = "KVPutError" as const;
}
