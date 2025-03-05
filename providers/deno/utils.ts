export function toKvKey(key: string): Deno.KvKey {
	return key.split("/");
}

export function fromKvKey(key: Deno.KvKey): string {
	return key.map((p) => p.toString().replaceAll("/", "\\/")).join("/");
}
