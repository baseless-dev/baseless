import * as log from "https://deno.land/std@0.118.0/log/mod.ts";
import { CloudflareKVProvider } from "https://baseless.dev/x/baseless_kv_cloudflarekv/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/baseless_auth_on_kv/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/baseless_db_on_kv/mod.ts";
import { SendgridMailProvider } from "https://baseless.dev/x/baseless_mail_sendgrid/mod.ts";
import {
	auth,
	clients,
	database,
	functions,
	mail,
} from "https://baseless.dev/x/baseless/worker.ts";
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
	async fetch(
		request: Request,
		env: Record<string, any>,
		ctx: { waitUntil(p: PromiseLike<unknown>): void },
	) {
		if (!server) {
			const [algKey, publicKey, privateKey] = await importKeys(
				env.DEMO_ALG_KEY,
				env.DEMO_PUBLIC_KEY,
				env.DEMO_PRIVATE_KEY,
			);
			const kvProvider = new CloudflareKVProvider(env.BASELESS_KV);
			const kvBackendAuth = new CloudflareKVProvider(env.BASELESS_AUTH);
			const kvBackendDb = new CloudflareKVProvider(env.BASELESS_DB);
			const authProvider = new AuthOnKvProvider(kvBackendAuth);
			const databaseProvider = new DatabaseOnKvProvider(kvBackendDb);
			// const mailProvider = new LoggerMailProvider();
			const mailProvider = new SendgridMailProvider({
				apiKey: env.DEMO_SENDGRID_KEY,
				from: { email: "auth@baseless.dev" },
				replyTo: { email: "noreply@baseless.dev" },
			});

			server = new Server({
				authProvider,
				kvProvider,
				databaseProvider,
				mailProvider,
				algKey,
				publicKey,
				privateKey,
			});
		}

		try {
			const [response, waitUntil] = await server.handle(request);
			for (const p of waitUntil) {
				ctx.waitUntil(p);
			}
			return response;
		} catch (err) {
			return new Response(JSON.stringify(err), { status: 500 });
		}
	},
};
