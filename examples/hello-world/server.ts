import * as log from "../../logger.ts";
// import { KVWebStorageProvider } from "../../providers/kv-webstorage/mod.ts";
// import { ClientKVProvider } from "../../providers/client-kv/mod.ts";
import { config } from "../../config.ts";
import { Server } from "../../server.ts";
import "./app.ts";

Deno.permissions.request({ name: "net" });
Deno.permissions.request({ name: "env" });

log.setGlobalLogHandler(log.createConsoleLogHandler(log.LogLevel.DEBUG));

const server = new Server(config.build());

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
				const request = new Request(event.request, { headers: { "x-forwarded-for": conn.remoteAddr.hostname, ...Object.fromEntries(event.request.headers) } });
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
