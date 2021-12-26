import * as log from "https://deno.land/std@0.118.0/log/mod.ts";
import { CloudflareKVProvider } from "https://baseless.dev/x/baseless_kv_cloudflarekv/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/baseless_auth_on_kv/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/baseless_db_on_kv/mod.ts";
import { MailLoggerProvider } from "https://baseless.dev/x/baseless_mail_logger/mod.ts";
import { auth, clients, database, functions, mail } from "https://baseless.dev/x/baseless/worker.ts";
import { importKeys, Server } from "https://baseless.dev/x/baseless/server.ts";
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

let server: Server | undefined;

export default {
	// deno-lint-ignore no-explicit-any
	async fetch(request: Request, env: Record<string, any>, ctx: { waitUntil(p: PromiseLike<unknown>): void }) {
		if (!server) {
			console.log(env.KEY_ALG, env.KEY_PUBLIC, env.KEY_PRIVATE);
			const [ algKey, publicKey, privateKey ] = await importKeys(env.KEY_ALG, env.KEY_PUBLIC, env.KEY_PRIVATE);
			const kvProvider = new CloudflareKVProvider(env.BASELESS_KV);
			const kvBackendAuth = new CloudflareKVProvider(env.BASELESS_AUTH);
			const kvBackendDb = new CloudflareKVProvider(env.BASELESS_DB);
			const authProvider = new AuthOnKvProvider(kvBackendAuth);
			const databaseProvider = new DatabaseOnKvProvider(kvBackendDb);
			const mailProvider = new MailLoggerProvider();

			server = new Server({
				clientsDescriptor: clients.build(),
				authDescriptor: auth.build(),
				databaseDescriptor: database.build(),
				functionsDescriptor: functions.build(),
				mailDescriptor: mail.build(),
				authProvider,
				kvProvider,
				databaseProvider,
				mailProvider,
				algKey,
				publicKey,
				privateKey,
			});
		}

		const url = new URL(request.url);

		try {
			const segments = url.pathname.replace(/(^\/|\/$)/, "").split("/");
			switch (segments[0]) {
				case "obase": {
					url.pathname = "/" + segments.splice(1).join("/");
					const req = new Request(url.toString(), request);
					const [response, waitUntil] = await server.handle(req);
					for (const p of waitUntil) {
						ctx.waitUntil(p);
					}
					return response;
				}
			}
			return new Response(null, { status: 404 });
		} catch (err) {
			return new Response(JSON.stringify(err), { status: 500 });
		}
	}
}