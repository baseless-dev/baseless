export class MemoryStorage implements Storage {
	public constructor(
		protected store: Map<string, string> = new Map(),
	) {}

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	key(index: number): string | null {
		const keys = Array.from(this.store.keys());
		if (index >= keys.length) {
			return null;
		}
		return keys.at(index) ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
}
