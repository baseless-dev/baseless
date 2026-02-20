import { Server, ServerOptions } from "./server.ts";
import {
	MemoryDocumentProvider,
	MemoryKVProvider,
	MemoryNotificationProvider,
	MemoryQueueProvider,
	MemoryRateLimiterProvider,
} from "@baseless/inmemory-provider";
import { DenoHubProvider } from "@baseless/deno-provider";
import * as z from "@baseless/core/schema";
import { ServiceCollection } from "./prelude.ts";
import { fromServerErrorData, ServerErrorData } from "@baseless/core/errors";
import { AppRegistry } from "./app.ts";
import { Request } from "@baseless/core/request";

export default async function createMemoryServer<TRegistry extends AppRegistry>(
	options: Omit<ServerOptions<TRegistry>, "providers">,
): Promise<
	{
		provider: {
			document: MemoryDocumentProvider;
			hub: DenoHubProvider;
			kv: MemoryKVProvider;
			notification: MemoryNotificationProvider;
			queue: MemoryQueueProvider;
		};
		fetch: <T extends z.ZodType = z.ZodUnknown>(
			endpoint: string,
			options: { method?: string; data?: unknown; headers?: Record<string, string>; schema?: T },
		) => Promise<z.infer<T>>;
		server: Server<TRegistry>;
		service: ServiceCollection;
	} & Disposable
> {
	const kv = new MemoryKVProvider();
	const document = new MemoryDocumentProvider();
	const queue = new MemoryQueueProvider();
	const hub = new DenoHubProvider();
	const notification = new MemoryNotificationProvider();
	const rateLimiter = new MemoryRateLimiterProvider();

	const server = new Server({
		...options,
		providers: {
			channels: { email: notification },
			document,
			hub,
			kv,
			queue,
			rateLimiter,
		},
	});

	async function fetch<T extends z.ZodType = z.ZodUnknown>(
		endpoint: string,
		options: { method?: string; data?: unknown; headers?: Record<string, string>; schema?: T },
	): Promise<z.infer<T>> {
		const [response, promises] = await server.handleRequest(
			new globalThis.Request(`http://test${endpoint}`, {
				method: options.method ?? "POST",
				headers: {
					...options.headers,
					"Content-Type": "application/json",
				},
				...(options.data ? { body: JSON.stringify(options.data) } : {}),
			}),
		);
		await Promise.allSettled(promises);
		const json = await response.json().catch((_) => undefined);
		if (response.status !== 200 && z.guard(ServerErrorData, json)) {
			throw fromServerErrorData(json);
		}

		z.assert(options.schema ?? z.unknown(), json);
		return json as never;
	}

	const { service } = await server.createContext(
		await Request.from(new globalThis.Request("http://test")),
		undefined,
		new AbortController().signal,
		() => {},
	);

	return {
		provider: {
			document,
			hub,
			kv,
			notification,
			queue,
		},
		fetch,
		server,
		service,
		[Symbol.dispose]: () => {
			kv[Symbol.dispose]();
			document[Symbol.dispose]();
			queue[Symbol.dispose]();
			hub[Symbol.dispose]();
		},
	};
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const deadline = (ms: number): Disposable => {
	const id = setTimeout(() => {
		throw new Error("Deadline reached.");
	}, ms);
	return { [Symbol.dispose]: () => clearTimeout(id) };
};
export const serve = async (server: Server<any>): Promise<{ url: URL } & Disposable> => {
	const ready = Promise.withResolvers<URL>();
	const abortController = new AbortController();
	Deno.serve({
		hostname: "localhost",
		port: 0,
		signal: abortController.signal,
		onListen: (localAddr) => {
			ready.resolve(new URL(`http://${localAddr.hostname === "::1" ? "[::1]" : localAddr.hostname}:${localAddr.port}`));
		},
	}, async (request) => {
		const [response, promises] = await server.handleRequest(request);
		await Promise.allSettled(promises);
		return response;
	});

	const listeningUrl = await ready.promise;

	return {
		get url() {
			return new URL(listeningUrl);
		},
		[Symbol.dispose]: () => abortController.abort(),
	};
};
export const connect = (url: URL, protocols?: string | string[]): {
	close(): void;
	message(): Promise<MessageEvent>;
	readyState(): Promise<WebSocket["readyState"]>;
	send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
} & Disposable => {
	const ws = new WebSocket(url, protocols);
	const abortController = new AbortController();
	const readyStateAsStream = new ReadableStream<WebSocket["readyState"]>({
		start(controller): void {
			ws.addEventListener("open", () => controller.enqueue(ws.readyState), { signal: abortController.signal });
			ws.addEventListener("close", () => controller.enqueue(ws.readyState), { signal: abortController.signal });
		},
		cancel(): void {
			abortController.abort();
		},
	});
	const readyStateIterator = readyStateAsStream.values();

	const messageAsStream = new ReadableStream<MessageEvent>({
		start(controller): void {
			ws.addEventListener("message", (event) => controller.enqueue(event), { signal: abortController.signal });
		},
		cancel(): void {
			abortController.abort();
		},
	});
	const messageIterator = messageAsStream.values();

	return {
		close(): void {
			ws.close();
		},
		async send(data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
			ws.send(data);
			await sleep(50);
		},
		async message(): Promise<MessageEvent> {
			const result = await messageIterator.next();
			if (!result.done) {
				return result.value;
			}
			throw new Error("Server closed");
		},
		async readyState(): Promise<WebSocket["readyState"]> {
			const result = await readyStateIterator.next();
			if (!result.done) {
				return result.value;
			}
			throw new Error("Server closed");
		},
		[Symbol.dispose]: () => ws.close(),
	};
};

export const pubsub = (
	mock: Awaited<ReturnType<typeof createMemoryServer>>,
): { next: () => Promise<void>; drain: () => Promise<void> } & AsyncDisposable => {
	const abortController = new AbortController();
	const stream = mock.provider.queue.dequeue(abortController.signal);
	const reader = stream.getReader();
	return {
		async next(): Promise<void> {
			try {
				const result = await reader.read();
				if (!result.done) {
					const promises = await mock.server.handleQueueItem(result.value);
					await Promise.allSettled(promises);
				}
			} catch (_cause) {
				return;
			}
		},
		async drain(): Promise<void> {
			while (true) {
				try {
					const result = await reader.read();
					if (!result.done) {
						const promises = await mock.server.handleQueueItem(result.value);
						await Promise.allSettled(promises);
					} else {
						break;
					}
				} catch (_cause) {
					break;
				}
			}
		},
		[Symbol.asyncDispose]: async () => {
			reader.releaseLock();
			await stream.cancel();
			abortController.abort();
		},
	};
};
