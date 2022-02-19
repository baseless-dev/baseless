export class PrefixedStorage implements Storage {
	public constructor(
		protected prefix: string,
		protected storage: Storage,
	) {}

	protected *keys(): Generator<string> {
		const l = this.storage.length;
		const p = `${this.prefix}_`;
		const pl = p.length;
		for (let i = 0; i < l; ++i) {
			const key = this.storage.key(i)!;
			if (key.substring(0, pl) === p) {
				yield key.substring(pl);
			}
		}
	}

	get length(): number {
		return Array.from(this.keys()).length;
	}

	clear(): void {
		const keys = Array.from(this.keys());
		for (const key of keys) {
			this.storage.removeItem(`${this.prefix}_${key}`);
		}
	}

	getItem(key: string): string | null {
		return this.storage.getItem(`${this.prefix}_${key}`) ?? null;
	}

	key(index: number): string | null {
		let i = 0;
		for (const key of this.keys()) {
			if (i++ === index) {
				return key;
			}
		}
		return null;
	}

	removeItem(key: string): void {
		this.storage.removeItem(`${this.prefix}_${key}`);
	}

	setItem(key: string, value: string): void {
		this.storage.setItem(`${this.prefix}_${key}`, value);
	}
}
