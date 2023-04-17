import * as log from "../../server/logger.ts";
import { config } from "../../server/config.ts";
import { Server } from "../../server/server.ts";
import { MemoryCounterProvider } from "../../server/providers/counter-memory/mod.ts";
import { WebStorageKVProvider } from "../../server/providers/kv-webstorage/mod.ts";
import { KVIdentityProvider } from "../../server/providers/identity-kv/mod.ts";
import { LoggerEmailProvider } from "../../server/providers/email-logger/mod.ts";
import "./app.ts";
import { autoid } from "../../shared/autoid.ts";
import { LocalAssetProvider } from "../../server/providers/asset-local/mod.ts";
import { CacheAssetProvider } from "../../server/providers/asset-cache/mod.ts";

Deno.permissions.request({ name: "net" });
Deno.permissions.request({ name: "env" });

log.setGlobalLogHandler(log.createConsoleLogHandler(log.LogLevel.LOG));

const configuration = config.build();

const assetProvider = new CacheAssetProvider("baseless-hello-world-public", new LocalAssetProvider(import.meta.resolve("./public")));

// const counterProvider = new MemoryCounterProvider();
// const identityKV = new WebStorageKVProvider(sessionStorage, "hello-world-idp/");
// const identityProvider = new KVIdentityProvider(identityKV);
// const emailProvider = new LoggerEmailProvider();

// // Create john's identity
// const johnId = await identityProvider.createIdentity({});
// await identityProvider.assignIdentityIdentification(johnId, "email", "john@doe.local");
// await identityProvider.assignIdentityChallenge(johnId, "password", "123");

const server = new Server({ configuration, assetProvider });

const listener = Deno.listen({ hostname: "0.0.0.0", port: 8080 });

console.log(``);
console.log(`  %c START %c       Baseless server started and listening`, "background-color: cyan; font-weight: bold", "");
for (const netint of Deno.networkInterfaces()) {
	if (netint.family === "IPv4") {
		console.log(`                http://${netint.address}:8080/`);
	}
}
console.log(``);

async function handle(conn: Deno.Conn) {
	const httpConn = Deno.serveHttp(conn);
	try {
		for await (const event of httpConn) {
			try {
				const request = new Request(event.request, { headers: { "x-real-ip": conn.remoteAddr.hostname, ...Object.fromEntries(event.request.headers) } });
				const [response, waitUntil] = await server.handleRequest(request);
				await event.respondWith(response);
				await Promise.all(waitUntil);
			} catch (err) {
				await event.respondWith(
					new Response(JSON.stringify(err), { status: 500 }),
				);
			}
		}
	} catch (err) {
		log.error(err);
	}
}

for await (const conn of listener) {
	handle(conn);
}
