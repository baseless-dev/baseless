import * as log from "https://deno.land/std@0.118.0/log/mod.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/baseless_kv_sqlite/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/baseless_auth_on_kv/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/baseless_db_on_kv/mod.ts";
import { LoggerMailProvider } from "https://baseless.dev/x/baseless_mail_logger/mod.ts";
import { Server } from "https://baseless.dev/x/baseless/server.ts";
import {
	exportPKCS8,
	exportSPKI,
	generateKeyPair,
} from "https://deno.land/x/jose@v4.3.7/index.ts";
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
const mailProvider = new LoggerMailProvider();

await kvProvider.open();
await kvBackendAuth.open();
await kvBackendDb.open();

const { publicKey, privateKey } = await generateKeyPair("RS256", {
	extractable: true,
});

// console.log(await exportSPKI(publicKey), await exportPKCS8(privateKey));

const server = new Server({
	authProvider,
	kvProvider,
	databaseProvider,
	mailProvider,
	algKey: "RS256",
	publicKey,
	privateKey,
});

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

log.info(`Serving on http://localhost:8787/`);

for await (const conn of listener) {
	handle(conn);
}

await kvProvider.close();
await kvBackendAuth.close();
await kvBackendDb.close();
