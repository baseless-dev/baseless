/**
 * Converts a slash-separated string key to a `Deno.KvKey` tuple.
 *
 * @param key - The slash-separated string key, e.g. `"users/123"`.
 * @returns A `Deno.KvKey` array suitable for use with the Deno KV API.
 */
export function toKvKey(key: string): Deno.KvKey {
	return key.split("/");
}

/**
 * Converts a `Deno.KvKey` tuple back to a slash-separated string key.
 *
 * Forward-slashes inside individual key segments are escaped with a
 * backslash so the round-trip is lossless.
 *
 * @param key - The `Deno.KvKey` tuple to convert.
 * @returns A slash-separated string representation of the key.
 */
export function fromKvKey(key: Deno.KvKey): string {
	return key.map((p) => p.toString().replaceAll("/", "\\/")).join("/");
}
