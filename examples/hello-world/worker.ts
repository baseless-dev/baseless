import { auth, database, functions, mail, Server } from "https://baseless.dev/x/server/mod.ts";
import { MemoryClientProvider } from "https://baseless.dev/x/provider-client-memory/mod.ts";
import { Client } from "https://baseless.dev/x/provider/client.ts";
import { importPKCS8, importSPKI } from "https://deno.land/x/jose@v4.3.7/key/import.ts";
import "./app.ts";

let server: Server | undefined;

export default {
	async fetch(
		request: Request,
		// deno-lint-ignore no-explicit-any
		env: Record<string, any>,
		ctx: { waitUntil(p: PromiseLike<unknown>): void },
	) {
		if (!server) {
			const algKey = env.DEMO_ALG_KEY;
			const publicKey = await importSPKI(
				env.DEMO_PUBLIC_KEY,
				algKey,
			);
			const privateKey = await importPKCS8(
				env.DEMO_PRIVATE_KEY,
				algKey,
			);

			const clientProvider = new MemoryClientProvider([
				new Client(
					"hello-world",
					"Hello World",
					["http://localhost:8787/", "https://hello-world.baseless.dev/"],
					"RS256",
					publicKey,
					privateKey,
				),
			]);

			server = new Server(
				auth.build(),
				database.build(),
				functions.build(),
				mail.build(),
				clientProvider,
			);
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
