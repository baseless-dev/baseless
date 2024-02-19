export default class MemoryStorage implements globalThis.Storage {
	#kv = new Map<string, string>();
	get length(): number {
		return this.#kv.size;
	}
	clear(): void {
		this.#kv.clear();
	}
	getItem(key: string): string | null {
		return this.#kv.get(key) ?? null;
	}
	key(index: number): string | null {
		return Array.from(this.#kv.keys()).at(index) ?? null;
	}
	removeItem(key: string): void {
		this.#kv.delete(key);
	}
	setItem(key: string, value: string): void {
		this.#kv.set(key, value);
	}
	toJSON(): Record<string, string> {
		return Object.fromEntries(this.#kv);
	}
	valueOf(): Record<string, string> {
		return this.toJSON();
	}
}
