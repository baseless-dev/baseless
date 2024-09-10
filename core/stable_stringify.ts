export function stableStringify(value?: unknown): string {
	return JSON.stringify(value, (_, v) => {
		if (typeof v !== "object" || v === null || Array.isArray(v)) {
			return v;
		}
		return Object.keys(v).sort().reduce((acc, key) => {
			acc[key] = v[key];
			return acc;
		}, {} as Record<string, unknown>);
	});
}
