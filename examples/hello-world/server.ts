import * as log from "../../common/system/logger.ts";
import { Server } from "../../server/server.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { WebStorageKVProvider } from "../../providers/kv-webstorage/mod.ts";
import { KVIdentityProvider } from "../../providers/identity-kv/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import { LocalAssetProvider } from "../../providers/asset-local/mod.ts";
import { WebCacheAssetProvider } from "../../providers/asset-webcache/mod.ts";
import { KVSessionProvider } from "../../providers/session-kv/mod.ts";
import { IdentityService } from "../../server/services/identity.ts";
import { EmailAuthentificationIdenticator } from "../../providers/auth-email/mod.ts";
import { PasswordAuthentificationChallenger } from "../../providers/auth-password/mod.ts";
import { TOTPLoggerAuthentificationChallenger } from "../../providers/auth-totp-logger/mod.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { Context } from "../../server/context.ts";
import { generateKey } from "../../common/system/otp.ts";
import { config } from "../../common/server/config/config.ts";
import "./app.ts";

Deno.permissions.request({ name: "read", path: import.meta.url });
Deno.permissions.request({ name: "write", path: import.meta.url });
Deno.permissions.request({ name: "net" });
Deno.permissions.request({ name: "env" });

log.setGlobalLogHandler(log.createConsoleLogHandler(log.LogLevel.LOG));

const configuration = config.build();

const email = new EmailAuthentificationIdenticator(
	new LoggerMessageProvider(),
);
const password = new PasswordAuthentificationChallenger();
const totp = new TOTPLoggerAuthentificationChallenger({
	period: 60,
	algorithm: "SHA-256",
	digits: 6,
});

const assetProvider = new LocalAssetProvider(import.meta.resolve("./public"));
const counterProvider = new MemoryCounterProvider();
const kvProvider = new MemoryKVProvider();
const identityKV = new MemoryKVProvider();
const identityProvider = new KVIdentityProvider(identityKV);
const sessionKV = new MemoryKVProvider();
const sessionProvider = new KVSessionProvider(sessionKV);
const context = new Context(
	[],
	"127.0.0.1",
	undefined,
	configuration,
	assetProvider,
	counterProvider,
	kvProvider,
	identityProvider,
	sessionProvider,
);

const identityService = context.identity;

const john = await identityService.create({});
await identityService.createIdentification({
	identityId: john.id,
	type: "email",
	identification: "john@test.local",
	verified: true,
	meta: {},
});
await identityService.createChallenge(
	john.id,
	"password",
	"123",
);
await identityService.createChallenge(
	john.id,
	"totp",
	await generateKey(16),
);

const server = new Server({ configuration, assetProvider, counterProvider, identityProvider, sessionProvider, kvProvider });

Deno.serve({
	hostname: "127.0.0.1",
	port: 8080,
	onListen({ hostname, port }) {
		console.log(``);
		console.log(`  %c START %c       Baseless server started and listening`, "background-color: cyan; font-weight: bold", "");
		console.log(`                http://${hostname ?? "localhost"}:${port}/`);
		console.log(``);
	},
	onError(error) {
		console.error(error);
		return new Response(null, { status: 500 });
	},
	async handler(request, info) {
		const [response, waitUntil] = await server.handleRequest(request, info.remoteAddr.hostname);
		await Promise.all(waitUntil);
		return response;
	}
});