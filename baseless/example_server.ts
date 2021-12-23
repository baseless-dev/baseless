import * as log from "https://deno.land/std@0.118.0/log/mod.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/baseless_kv_sqlite/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/baseless_auth_on_kv/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/baseless_db_on_kv/mod.ts";
import { MailLoggerProvider } from "https://baseless.dev/x/baseless_mail_logger/mod.ts";
import { auth, clients, database, functions, mail } from "./worker.ts";
import { createOBaseHandler, importKeys } from "./server.ts";

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

const [publicKey, privateKey] = await importKeys(
	"ES256",
	`-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE386KJCE4b+Ecq+bMthxvRkMo6++JmyrjE2qjNldGtH+bfHw5tN6JuI0TP1NpoY4pvhJLYm6mpfGAAC89PHg+uw==-----END PUBLIC KEY-----`,
	`-----BEGIN PRIVATE KEY-----MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgiXo0+yHJXAIWXOjuyKIetWOmx1/LYs9mSCxDfeWt5+6hRANCAATfzookIThv4Ryr5sy2HG9GQyjr74mbKuMTaqM2V0a0f5t8fDm03om4jRM/U2mhjim+Ektibqal8YAALz08eD67-----END PRIVATE KEY-----`,
);

auth.allowAnonymousUser(true).allowSignMethodPassword(true);

clients.register(
	"Hello World",
	"http://localhost:8080/",
	"hello-world",
	"secret",
);

// deno-lint-ignore require-await
functions.http("hello-world").onCall(async () => {
	return new Response("Hello World!");
});

const handleOBase = await createOBaseHandler({
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
					const [response, waitUntil] = await handleOBase(request);
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

const server = Deno.listen({ port: 8080 });

log.info(`Server listening on http://localhost:8080/`);

for await (const conn of server) {
	handle(conn);
}

await kvProvider.close();
await kvBackendAuth.close();
await kvBackendDb.close();
