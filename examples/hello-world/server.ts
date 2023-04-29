import * as log from "../../server/logger.ts";
import { config } from "../../server/config.ts";
import { Server } from "../../server/server.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { WebStorageKVProvider } from "../../providers/kv-webstorage/mod.ts";
import { KVIdentityProvider } from "../../providers/identity-kv/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import "./app.ts";
import { LocalAssetProvider } from "../../providers/asset-local/mod.ts";
import { WebCacheAssetProvider } from "../../providers/asset-webcache/mod.ts";
import { KVSessionProvider } from "../../providers/session-kv/mod.ts";
import { IdentityService } from "../../server/services/identity.ts";

Deno.permissions.request({ name: "read", path: import.meta.url });
Deno.permissions.request({ name: "net" });
Deno.permissions.request({ name: "env" });

log.setGlobalLogHandler(log.createConsoleLogHandler(log.LogLevel.LOG));

const configuration = config.build();

await caches.delete("baseless-hello-world-public");
const assetProvider = new WebCacheAssetProvider(await caches.open("baseless-hello-world-public"), new LocalAssetProvider(import.meta.resolve("./public")));
const counterProvider = new MemoryCounterProvider();
const kvProvider = new WebStorageKVProvider(sessionStorage, "hello-world-kv/");
const identityKV = new WebStorageKVProvider(sessionStorage, "hello-world-idp/");
const identityProvider = new KVIdentityProvider(identityKV);
const sessionKV = new WebStorageKVProvider(sessionStorage, "hello-world-session/");
const sessionProvider = new KVSessionProvider(sessionKV);
const messageProvider = new LoggerMessageProvider();

const identityService = new IdentityService(configuration, identityProvider, counterProvider);
const john = await identityService.create({});
await identityService.createIdentification({
	identityId: john.id,
	type: "email",
	identification: "john@test.local",
	verified: true,
	meta: {},
});
await identityService.createChallenge(
	john.id,
	"password",
	"123",
);

const server = new Server({ configuration, assetProvider, counterProvider, identityProvider, sessionProvider, kvProvider });

Deno.serve({
	hostname: "127.0.0.1",
	port: 8080,
	onListen({ hostname, port }) {
		console.log(``);
		console.log(`  %c START %c       Baseless server started and listening`, "background-color: cyan; font-weight: bold", "");
		console.log(`                http://${hostname ?? "127.0.0.1"}:${port}/`);
		console.log(``);
	},
	onError(error) {
		console.error(error);
		return new Response(null, { status: 500 });
	},
	async handler(request, info) {
		const [response, waitUntil] = await server.handleRequest(request, info.remoteAddr.hostname);
		await Promise.all(waitUntil);
		return response;
	}
});