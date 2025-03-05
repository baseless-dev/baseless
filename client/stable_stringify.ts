export function stableStringify(value?: unknown): string {
	return JSON.stringify(value, (_, v) => {
		if (typeof v !== "object" || v === null || Array.isArray(v)) {
			return v;
		}
		if (v instanceof Date) {
			return v.toISOString();
		}
		return Object.keys(v)
			.sort()
			.reduce((acc, key) => ({ ...acc, [key]: v[key] }), {} as Record<string, unknown>);
	});
}
