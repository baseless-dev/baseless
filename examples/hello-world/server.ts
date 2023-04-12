import * as log from "../../server/logger.ts";
import { config } from "../../server/config.ts";
import { Server } from "../../server/server.ts";
import { MemoryCounterProvider } from "../../server/providers/counter-memory/mod.ts";
import { WebStorageKVProvider } from "../../server/providers/kv-webstorage/mod.ts";
import { KVIdentityProvider } from "../../server/providers/identity-kv/mod.ts";
import "./app.ts";
import { autoid } from "../../shared/autoid.ts";
import { hashPassword } from "../../server/auth/flow.ts";

Deno.permissions.request({ name: "net" });
Deno.permissions.request({ name: "env" });

log.setGlobalLogHandler(log.createConsoleLogHandler(log.LogLevel.LOG));

const configuration = config.build();

const counterProvider = new MemoryCounterProvider();
const identityKV = new WebStorageKVProvider(sessionStorage, "hello-world-idp/");
const identityProvider = new KVIdentityProvider(identityKV);

// Create john's identity
const johnId = autoid();
await identityProvider.createIdentity(johnId, {});
// Assign two email to john's identity
await identityProvider.assignIdentityIdentification(johnId, "email", "john@doe.local");
// Assign a password challenge to `123`
await identityProvider.assignIdentityChallenge(johnId, "password", await hashPassword(configuration.auth.salt, "123"));

const server = new Server({ configuration, counterProvider, identityProvider });

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
