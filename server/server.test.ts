// deno-lint-ignore-file require-await
import { assert, assertEquals } from "@std/assert";
import { Server } from "./server.ts";
import { Type } from "@sinclair/typebox";
import { isResultError, isResultSingle } from "@baseless/core/result";
import { MemoryDocumentProvider, MemoryEventProvider, MemoryKVProvider } from "@baseless/inmemory-provider";
import { ApplicationBuilder } from "./application_builder.ts";
import { Permission } from "./types.ts";
import { DenoHubProvider } from "@baseless/deno-provider/hub";

Deno.test("Server", async (t) => {
	const setupBaselessServer = () => {
		const app = new ApplicationBuilder()
			.event(["foo"], { payload: Type.String(), security: async () => Permission.All })
			.rpc(["hello"], {
				input: Type.String(),
				output: Type.String(),
				handler: async ({ input }) => input,
				security: async () => Permission.All,
			})
			.build();
		const hubProvider = new DenoHubProvider();
		const server = new Server(app, {
			document: new MemoryDocumentProvider(),
			event: new MemoryEventProvider(hubProvider),
			hub: hubProvider,
			kv: new MemoryKVProvider(),
		}, {});
		return { app, server };
	};

	await t.step("handle command", async () => {
		const { server } = setupBaselessServer();
		const [result, promises] = await server.handleCommand({
			kind: "rpc",
			rpc: ["hello"],
			input: "world",
		});
		assert(isResultSingle(result));
		assertEquals(result.value, "world");
		assertEquals(promises.length, 0);
	});
	await t.step("handle request", async () => {
		const { server } = setupBaselessServer();
		{
			const [response, promises] = await server.handleRequest(
				new Request("https://local", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						kind: "rpc",
						rpc: ["not found"],
						input: "silence is golden",
					}),
				}),
			);
			assertEquals(response.status, 200);
			assertEquals(promises.length, 0);
			const result = await response.json();
			assert(isResultError(result));
			assertEquals(result.error, "UnknownRpcError");
		}
		{
			const [response, promises] = await server.handleRequest(
				new Request("https://local", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						kind: "rpc",
						rpc: ["hello"],
						input: "world",
					}),
				}),
			);
			assertEquals(response.status, 200);
			assertEquals(promises.length, 0);
			const result = await response.json();
			assert(isResultSingle(result));
			assertEquals(result.value, "world");
		}
	});
	await t.step("handle websocket", async () => {
		using _d = deadline(1000);
		using httpServer = await setupHttpServer();
		const { server: baselessServer } = setupBaselessServer();

		const wsSocketUrl = new URL(httpServer.url);
		wsSocketUrl.protocol = "ws";
		// // const wsSocket = new WebSocket(wsSocketUrl.toString(), ["base64url.bearer.authorization.baseless.dev.blep"]);
		using ws = setupWebSocket(wsSocketUrl, []);

		await handleOneRequest(httpServer, baselessServer);

		assertEquals(await ws.nextReadyState(), WebSocket.OPEN);

		// Subscribe to foo event
		ws.send(JSON.stringify({ kind: "event-subscribe", event: ["foo"] }));

		const request1 = fetch(httpServer.url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				kind: "event-publish",
				event: ["foo"],
				payload: "foofoo",
			}),
		});

		await handleOneRequest(httpServer, baselessServer);

		const response1 = await request1;
		response1.body?.cancel();

		const message1 = await ws.nextMessage();
		assertEquals(message1.data, JSON.stringify({ kind: "event", event: ["foo"], payload: "foofoo" }));

		ws.close();

		assertEquals(await ws.nextReadyState(), WebSocket.CLOSED);
	});
});

type RequestHandlerHandoff = { request: Request; respondWith: (response: Response) => void };
async function setupHttpServer(options?: { hostname?: string; port?: number }): Promise<
	{
		nextRequest: () => Promise<RequestHandlerHandoff>;
		url: URL;
	} & Disposable
> {
	const hostname = options?.hostname ?? "localhost";
	const port = options?.port ?? 0;
	const ready = Promise.withResolvers<URL>();
	const abortController = new AbortController();
	const serverAsStream = new ReadableStream<{ request: Request; respondWith: (response: Response) => void }>({
		start(controller): void {
			Deno.serve(
				{
					hostname,
					port,
					signal: abortController.signal,
					onListen(netAddr): void {
						ready.resolve(new URL(`http://${netAddr.hostname === "::1" ? "[::1]" : netAddr.hostname}:${netAddr.port}`));
					},
				},
				async (request) => {
					const gate = Promise.withResolvers<Response>();
					controller.enqueue({ request, respondWith: (response) => gate.resolve(response) });
					const response = await gate.promise;
					return response;
				},
			);
			abortController.signal.addEventListener("abort", () => controller.close());
		},
		cancel(): void {
			// abortController.abort();
		},
	});
	const requestIterator = serverAsStream.values();

	const listeningUrl = await ready.promise;

	return {
		get url() {
			return new URL(listeningUrl);
		},
		async nextRequest(): Promise<RequestHandlerHandoff> {
			const result = await requestIterator.next();
			if (!result.done) {
				return result.value;
			}
			throw new Error("Server closed");
		},
		[Symbol.dispose]: () => abortController.abort(),
	};
}

function setupWebSocket(url: URL, protocols?: string | string[]): {
	close(): void;
	nextMessage(): Promise<MessageEvent>;
	nextReadyState(): Promise<WebSocket["readyState"]>;
	send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
} & Disposable {
	const ws = new WebSocket(url, protocols);
	const abortController = new AbortController();
	const readyStateAsStream = new ReadableStream<WebSocket["readyState"]>({
		start(controller): void {
			ws.addEventListener("open", () => controller.enqueue(ws.readyState), { signal: abortController.signal });
			ws.addEventListener("close", () => controller.enqueue(ws.readyState), { signal: abortController.signal });
		},
		cancel(): void {
			console.log("readyStateAsStream.cancel");
			abortController.abort();
		},
	});
	const readyStateIterator = readyStateAsStream.values();

	const messageAsStream = new ReadableStream<MessageEvent>({
		start(controller): void {
			ws.addEventListener("message", (event) => controller.enqueue(event), { signal: abortController.signal });
		},
		cancel(): void {
			console.log("messageAsStream.cancel");
			abortController.abort();
		},
	});
	const messageIterator = messageAsStream.values();

	return {
		close(): void {
			ws.close();
		},
		send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
			ws.send(data);
		},
		async nextMessage(): Promise<MessageEvent> {
			const result = await messageIterator.next();
			if (!result.done) {
				return result.value;
			}
			throw new Error("Server closed");
		},
		async nextReadyState(): Promise<WebSocket["readyState"]> {
			const result = await readyStateIterator.next();
			if (!result.done) {
				return result.value;
			}
			throw new Error("Server closed");
		},
		[Symbol.dispose]: () => ws.close(),
	};
}

async function handleOneRequest(httpServer: Awaited<ReturnType<typeof setupHttpServer>>, baselessServer: Server): Promise<void> {
	const { request, respondWith } = await httpServer.nextRequest();
	const [response, _promises] = await baselessServer.handleRequest(request);
	respondWith(response);
}

function deadline(ms: number): Disposable {
	const id = setTimeout(() => {
		throw new Error("Deadline reached.");
	}, ms);
	return { [Symbol.dispose]: () => clearTimeout(id) };
}
