import * as app from "./app.ts";
import { Server } from "@baseless/server";
import { DenoHubProvider, DenoKVDocumentProvider, DenoKVProvider, DenoQueueProvider } from "@baseless/deno-provider";
import { ConsoleNotificationProvider } from "@baseless/inmemory-provider";

const bd1 = await Deno.openKv("./db/kv");
const bd2 = await Deno.openKv("./db/doc");

const document = new DenoKVDocumentProvider(bd2);
const queue = new DenoQueueProvider(bd1);
const hub = new DenoHubProvider();
const kv = new DenoKVProvider(bd1);
const notification = new ConsoleNotificationProvider();

const baseless = new Server({
	definitions: app,
	providers: {
		channels: { email: notification },
		document,
		queue,
		hub,
		kv,
	},
	requirements: {
		world: "world",
		stripe: undefined,
		stripeWebhookSecret: undefined,
	},
});

const abortController = new AbortController();

console.log("Press Ctrl-C to trigger a SIGINT signal");

// Deno.addSignalListener("SIGINT", () => {
// 	console.log("SIGINT received, shutting down...");
// 	abortController.abort();
// });

Deno.serve(
	{
		hostname: "127.0.0.1",
		port: 4000,
		signal: abortController.signal,
	},
	async (request) => {
		const [response, promises] = await baseless.handleRequest(request);
		await Promise.allSettled(promises);
		return response;
	},
);

for await (const item of queue.dequeue(abortController.signal)) {
	await baseless.handleQueueItem(item);
}
