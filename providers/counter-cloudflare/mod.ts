import {
	CounterIncrementError,
	CounterResetError,
} from "../../client/errors.ts";
import { createLogger } from "../../common/system/logger.ts";
import type { CounterProvider } from "../counter.ts";
/// <reference types="https://esm.sh/v132/@cloudflare/workers-types@4.20230914.0/index.d.ts" />

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

export class CloudFlareCounterProvider implements CounterProvider {
	#logger = createLogger("counter-cloudflare");
	#do: DurableObjectNamespace;

	// deno-lint-ignore no-explicit-any
	constructor(doNS: any) {
		this.#do = doNS;
	}

	async increment(
		key: string[],
		amount: number,
		expiration?: number | Date,
	): Promise<number> {
		const keyString = keyPathToKeyString(key);
		const doId = this.#do.idFromName(keyString);
		const doStud = this.#do.get(doId);
		const expireAt = expiration
			? expiration instanceof Date
				? expiration.getTime()
				: expiration + new Date().getTime()
			: undefined;
		const response = await doStud.fetch("https://example.com/increment", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ amount, expireAt }),
		}).catch(() => undefined);
		if (response?.status !== 200) {
			throw new CounterIncrementError();
		}
		const { counter } = await response.json() as { counter: number };
		return counter;
	}

	async reset(key: string[]): Promise<void> {
		const keyString = keyPathToKeyString(key);
		const doId = this.#do.idFromName(keyString);
		const doStud = this.#do.get(doId);
		const response = await doStud.fetch("https://example.com/reset")
			.catch(() => undefined);
		if (response?.status !== 200) {
			throw new CounterResetError();
		}
	}
}

export class CloudFlareCounterDurableObject /*implements DurableObject*/ {
	#logger = createLogger("counter-cloudflare-do");
	#storage: DurableObjectStorage;
	#counter: number;

	// deno-lint-ignore no-explicit-any
	constructor(state: any) {
		this.#storage = state.storage;
		this.#counter = 0;
		state.blockConcurrencyWhile(async () => {
			this.#counter = await this.#storage.get("counter") ?? 0;
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const op = url.pathname.split("/")[1];

		if (op === "increment") {
			const { amount, expireAt } = await request.json() as {
				amount: number;
				expireAt?: number;
			};
			this.#counter += amount;
			await this.#storage.put("counter", this.#counter);
			if (expireAt) {
				await this.#storage.setAlarm(expireAt);
			}
			return Response.json({ counter: this.#counter }, { status: 200 });
		} else if (op === "reset") {
			this.#counter = 0;
			await this.#storage.delete("counter");
			return Response.json({ counter: this.#counter }, { status: 200 });
		}
		return new Response("Bad Request", { status: 400 });
	}

	async alarm(): Promise<void> {
		this.#counter = 0;
		await this.#storage.delete("counter");
	}
}
