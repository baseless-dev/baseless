import app from "./app.ts";
import { Server } from "@baseless/server";
import { DenoHubProvider, DenoKVDocumentProvider, DenoKVProvider, DenoQueueProvider } from "@baseless/deno-provider";
import { ConsoleNotificationProvider, MemoryRateLimiterProvider } from "@baseless/inmemory-provider";

await Deno.mkdir("./db", { recursive: true }).catch(() => {});

const bd1 = await Deno.openKv("./db/kv");
const bd2 = await Deno.openKv("./db/doc");

const document = new DenoKVDocumentProvider(bd2);
const queue = new DenoQueueProvider(bd1);
const hub = new DenoHubProvider();
const kv = new DenoKVProvider(bd1);
const notification = new ConsoleNotificationProvider();
const rateLimiter = new MemoryRateLimiterProvider();

const baseless = new Server({
	app: app.build(),
	providers: {
		channels: { email: notification },
		document,
		queue,
		hub,
		kv,
		rateLimiter,
	},
	configuration: {
		openapi: {
			info: {
				title: "Hello World API",
				description: "This is a sample API for demonstration purposes.",
				version: "1.0.0",
			},
		},
	},
});

console.log("Press Ctrl-C to trigger a SIGINT signal");

Deno.serve(
	{
		hostname: "127.0.0.1",
		port: 4000,
	},
	async (request) => {
		const [response, promises] = await baseless.handleRequest(request);
		await Promise.allSettled(promises);
		return response;
	},
);

for await (const item of queue.dequeue()) {
	await baseless.handleQueueItem(item);
}
