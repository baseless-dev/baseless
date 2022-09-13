import * as log from "https://baseless.dev/x/baseless/logger.ts";
// import { KVWebStorageProvider } from "https://baseless.dev/x/baseless-kv-webstorage/mod.ts";
// import { ClientKVProvider } from "https://baseless.dev/x/baseless-client-kv/mod.ts";
import { config } from "https://baseless.dev/x/baseless/config.ts";
import { Baseless } from "https://baseless.dev/x/baseless/lib.ts";
import "./app.ts";

Deno.permissions.request({ name: "net" });
Deno.permissions.request({ name: "env" });

log.setGlobalLogHandler(log.createConsoleLogHandler(log.LogLevel.DEBUG));

const baseless = new Baseless(config.build());

const listener = Deno.listen({ hostname: "0.0.0.0", port: 8787 });

console.log(``);
console.log(`  %c START %c       Baseless server started and listening`, "background-color: cyan; font-weight: bold", "");
for (const netint of Deno.networkInterfaces()) {
	console.log(`                http://${netint.family === "IPv4" ? netint.address : `[${netint.address}]`}:8787/`);
}
console.log(``);

async function handle(conn: Deno.Conn) {
	const httpConn = Deno.serveHttp(conn);
	try {
		for await (const event of httpConn) {
			try {
				const [response, waitUntil] = await baseless.handleRequest(event.request);
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
