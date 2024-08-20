export function stableStringify(value?: unknown): string {
	return JSON.stringify(value, (k, v) => {
		if (
			typeof v === "number" || typeof v === "string" || typeof v === "boolean" ||
			typeof v === "undefined" || typeof v === "symbol" || v === null
		) {
			return v;
		} else if (typeof v === "bigint") {
			return v.toString();
		}
		return Object.keys(v).sort().reduce((acc, key) => {
			acc[key] = v[key];
			return acc;
		}, {} as Record<string, unknown>);
	});
}
