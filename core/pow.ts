const encoder = new TextEncoder();

/** Error thrown when a proof-of-work computation is cancelled via an {@link AbortSignal}. */
export class WorkAbortedError extends Error {}

async function hash(data: string): Promise<Uint8Array> {
	const buffer = encoder.encode(data);
	const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
	return new Uint8Array(hashBuffer);
}

function numberOfLeadingZeroes(buffer: Uint8Array): number {
	let i = 0;
	const l = buffer.length * 8;
	for (; i < l && ((buffer[Math.floor(i / 8)] >> (7 - (i % 8))) & 0b1) === 0; i++);
	return i;
}

async function _work(challenge: string, difficulty: number, signal?: AbortSignal, threads = 1, nonce = 0): Promise<number> {
	let hashHex;
	threads ??= 1;

	do {
		if (signal?.aborted === true) {
			throw new WorkAbortedError();
		}
		hashHex = await hash(challenge + nonce);
		nonce += threads;
	} while (numberOfLeadingZeroes(hashHex) < difficulty);

	return nonce - threads;
}

/**
 * Verifies a proof-of-work nonce against a challenge and difficulty target.
 * @param challenge The challenge string used during work computation.
 * @param difficulty The minimum number of leading zero bits required in the SHA-1 hash.
 * @param nonce The nonce produced by {@link work}.
 * @returns `true` when the `hash(challenge + nonce)` satisfies the difficulty.
 */
export async function verify(challenge: string, difficulty: number, nonce: number): Promise<boolean> {
	const hashHex = await hash(challenge + nonce);
	return numberOfLeadingZeroes(hashHex) >= difficulty;
}

declare const addEventListener: (
	type: string,
	listener: EventListenerOrEventListenerObject,
	options?: boolean | AddEventListenerOptions,
) => void;
declare const postMessage: (message: any, transfer?: Transferable[]) => void;

type WorkerAction =
	| { type: "work"; challenge: string; difficulty: number; threads: number; nonce: number }
	| { type: "abort" };
type WorkerResult =
	| { type: "nonce"; nonce: number }
	| { type: "error"; error: any };

/**
 * Finds a nonce satisfying the given proof-of-work difficulty.
 * When `options.threads` is specified the work is distributed across
 * multiple Web Workers.
 *
 * @param challenge The challenge string to hash against.
 * @param difficulty The number of leading zero bits required.
 * @param options Optional `{ threads, signal }` configuration.
 * @returns A promise that resolves to the nonce value.
 * @throws {@link WorkAbortedError} When the computation is aborted via `signal`.
 */
export function work(challenge: string, difficulty: number, options?: { threads?: number; signal?: AbortSignal }): Promise<number> {
	const threads = options?.threads ?? undefined;
	if (threads === undefined) {
		return _work(challenge, difficulty, options?.signal, 1, 0);
	}

	const glue = () => {
		let abortController: AbortController | undefined;
		addEventListener("message", async (event) => {
			const action = (event as any).data as WorkerAction;
			if (action.type === "work") {
				abortController?.abort();
				abortController = new AbortController();
				try {
					const nonce = await _work(action.challenge, action.difficulty, abortController.signal, action.threads, action.nonce);
					postMessage({ type: "nonce", nonce });
				} catch (error) {
					postMessage({ type: "error", error });
				}
			} else if (action.type === "abort") {
				abortController?.abort();
			}
		});
	};
	const code =
		`const encoder = new TextEncoder();\nclass WorkAbortedError extends Error {}\n${hash.toString()}\n${numberOfLeadingZeroes.toString()}\n${_work.toString()}\n(${glue.toString()})()`;
	const blob = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
	const workers: Worker[] = [];
	const abortController = new AbortController();
	const nonceDefer = Promise.withResolvers<number>();
	options?.signal?.addEventListener("abort", () => {
		abortController.abort();
		nonceDefer.reject(new WorkAbortedError());
	});
	for (let i = 0; i < threads; i++) {
		const worker = new Worker(blob, { type: "module" });
		abortController.signal.addEventListener("abort", () => {
			worker.postMessage({ type: "abort" });
			worker.terminate();
		});
		worker.addEventListener("message", (event) => {
			const result = (event as any).data as WorkerResult;
			try {
				if (result.type === "error") {
					nonceDefer.reject(result.error);
				} else {
					nonceDefer.resolve(result.nonce);
				}
				abortController.abort();
			} catch (_cause) {}
		});
		worker.postMessage({ type: "work", challenge, difficulty, threads, nonce: i });
		workers.push(worker);
	}
	return nonceDefer.promise;
}
