import * as log from "https://deno.land/std@0.118.0/log/mod.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/baseless_kv_sqlite/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/baseless_auth_on_kv/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/baseless_db_on_kv/mod.ts";
import { MailLoggerProvider } from "https://baseless.dev/x/baseless_mail_logger/mod.ts";
import { auth, clients, database, functions, mail } from "https://baseless.dev/x/baseless/worker.ts";
import { Server } from "https://baseless.dev/x/baseless/server.ts";
import { generateKeyPair, exportPKCS8, exportSPKI } from "https://deno.land/x/jose@v4.3.7/index.ts";
import "./app.ts";

await log.setup({
	handlers: {
		console: new log.handlers.ConsoleHandler("DEBUG"),
	},
	loggers: {
		default: {
			level: "DEBUG",
			handlers: ["console"],
		},
		baseless_server: {
			level: "DEBUG",
			handlers: ["console"],
		},
		baseless_mail_logger: {
			level: "DEBUG",
			handlers: ["console"],
		},
	},
});

const kvProvider = new SqliteKVProvider(":memory:");
const kvBackendAuth = new SqliteKVProvider(":memory:");
const kvBackendDb = new SqliteKVProvider(":memory:");
const authProvider = new AuthOnKvProvider(kvBackendAuth);
const databaseProvider = new DatabaseOnKvProvider(kvBackendDb);
const mailProvider = new MailLoggerProvider();

await kvProvider.open();
await kvBackendAuth.open();
await kvBackendDb.open();

const { publicKey, privateKey } = await generateKeyPair("RS512", { extractable: true });

const server = new Server({
	clientsDescriptor: clients.build(),
	authDescriptor: auth.build(),
	databaseDescriptor: database.build(),
	functionsDescriptor: functions.build(),
	mailDescriptor: mail.build(),
	authProvider,
	kvProvider,
	databaseProvider,
	mailProvider,
	algKey: "ES256",
	publicKey,
	privateKey,
});

async function handle(conn: Deno.Conn) {
	const httpConn = Deno.serveHttp(conn);
	for await (const event of httpConn) {
		const url = new URL(event.request.url);
		try {
			const segments = url.pathname.replace(/(^\/|\/$)/, "").split("/");
			switch (segments[0]) {
				case "obase": {
					url.pathname = "/" + segments.splice(1).join("/");
					const request = new Request(url.toString(), event.request);
					const [response, waitUntil] = await server.handle(request);
					await event.respondWith(response);
					await Promise.all(waitUntil);
					break;
				}
				default: {
					await event.respondWith(new Response(null, { status: 404 }));
				}
			}
		} catch (err) {
			await event.respondWith(
				new Response(JSON.stringify(err), { status: 500 }),
			);
		}
	}
}

const listener = Deno.listen({ port: 8787 });

log.info(`Serving on http://localhost:8787/obase`);

for await (const conn of listener) {
	handle(conn);
}

await kvProvider.close();
await kvBackendAuth.close();
await kvBackendDb.close();
