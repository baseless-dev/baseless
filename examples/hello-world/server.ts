import * as log from "https://baseless.dev/x/logger/deno/mod.ts";
import {
	auth,
	database,
	functions,
	mail,
	Server,
} from "https://baseless.dev/x/server/deno/mod.ts";
import {
	exportPKCS8,
	exportSPKI,
	generateKeyPair,
} from "https://deno.land/x/jose@v4.3.7/index.ts";
import "./app.ts";
import { MemoryClientProvider } from "https://baseless.dev/x/provider-client-memory/deno/mod.ts";
import { Client } from "https://baseless.dev/x/provider/deno/client.ts";

const { publicKey, privateKey } = await generateKeyPair("RS256", {
	extractable: true,
});

const clientProvider = new MemoryClientProvider([
	new Client(
		"hello-world",
		"Hello World",
		["http://localhost:8080/", "https://hello-world.baseless.dev/"],
		"RS256",
		publicKey,
		privateKey,
	),
]);

const server = new Server(
	auth.build(),
	database.build(),
	functions.build(),
	mail.build(),
	clientProvider,
);

async function handle(conn: Deno.Conn) {
	const httpConn = Deno.serveHttp(conn);
	for await (const event of httpConn) {
		try {
			const [response, waitUntil] = await server.handle(event.request);
			await event.respondWith(response);
			await Promise.all(waitUntil);
		} catch (err) {
			await event.respondWith(
				new Response(JSON.stringify(err), { status: 500 }),
			);
		}
	}
}

const listener = Deno.listen({ port: 8787 });

log.info(`Baseless server listening on http://localhost:8787/`);

for await (const conn of listener) {
	handle(conn);
}
