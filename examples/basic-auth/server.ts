import * as log from "https://baseless.dev/x/logger/mod.ts";
import { auth, database, functions, mail, Server } from "https://baseless.dev/x/server/mod.ts";
import { importPKCS8, importSPKI } from "https://deno.land/x/jose@v4.3.7/key/import.ts";
import "./app.ts";
import { MemoryClientProvider } from "https://baseless.dev/x/provider-client-memory/mod.ts";
import { Client } from "https://baseless.dev/x/provider/client.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/provider-kv-sqlite/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/provider-auth-on-kv/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/provider-db-on-kv/mod.ts";
import { LoggerMailProvider } from "https://baseless.dev/x/provider-mail-logger/mod.ts";

const publicKey = await importSPKI(
	"-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvYSmNTflBIr2Q2z/oVSR+SfhSfelM+ZL/wb+4LenIaRSLdNm8JGD5TI4i1n3qRyPTxbqa70n4Jwx9H8hLMs/qYml0wCEAmrAqqXixku4gz6TtO25D8cXPlquCfNVRO2Dt7CK4ZCUgwVizqJC6+ZIM6fiTI4/rIU6SRb/ZClHuaGspYx4BVW+2AxgzckaojNosiof/7oac4WZck109jCEVE201E8YUumSZtkAxuzFnzPYFKyK4hztpZScSLvvM4Cty7LkwzZLuTkFXgspJ3SzFa6WR9vLleL4GmMBe0Cq8NU8DhdrNgkAt0Ngksf4mFaTpS4p+bKFEdwchVTUzRKlLQIDAQAB-----END PUBLIC KEY-----",
	"RS256",
);
const privateKey = await importPKCS8(
	"-----BEGIN PRIVATE KEY-----MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC9hKY1N+UEivZDbP+hVJH5J+FJ96Uz5kv/Bv7gt6chpFIt02bwkYPlMjiLWfepHI9PFuprvSfgnDH0fyEsyz+piaXTAIQCasCqpeLGS7iDPpO07bkPxxc+Wq4J81VE7YO3sIrhkJSDBWLOokLr5kgzp+JMjj+shTpJFv9kKUe5oayljHgFVb7YDGDNyRqiM2iyKh//uhpzhZlyTXT2MIRUTbTUTxhS6ZJm2QDG7MWfM9gUrIriHO2llJxIu+8zgK3LsuTDNku5OQVeCykndLMVrpZH28uV4vgaYwF7QKrw1TwOF2s2CQC3Q2CSx/iYVpOlLin5soUR3ByFVNTNEqUtAgMBAAECggEAGVcyTi1iHwBhu1RIvg6r0g/mDNjjKxRhFwGddPi5jUMGhgAdZI9gfnX/n4pxFhiuhNnAkJVjTqIz/8g77Fxk78tq89K+0//oMSkrMG6RhmMIpwmeVCC/1+OSH9x8i1Hi6d3eRBjr8rT2qECECDzrbJTHKotesjfCOmGr1n26jHR51JyRXm4GpYpkxj4O+Fgtucoj2y11w4hm1wWmQisaFaEV/1tbUFN2v1kGR5D0AFZ1RU3IDX45+EHaTV2K8KrlttCqf1xPeAlMkg71Rl6ecU32ssIh4P+mps8l65pf1VyD9X6cjoVjYX32+3tbSg+zsI4+etDV4p7Doki3SYCE4QKBgQDdOsQwoKjbJttfQrU1A6CLg2TQGeudbZFk8MC8nff+GT9YVOp3tGRxPJE7MfhKQHnE6fbAiBhQS+s/fyLK30MshUlgpC3DUjd+ccDfWA+ZLT4ohlSYqha9cnNKMXy2uPLLZ1d/JA9ENAYVrDJj4EMz580mJAkfLg0gE0/uqgg4pQKBgQDbTfdIy6vk2BpbLoEXebsW2f8T+JTwY3ZXZ3KQy2ZpZ5Km69p0v9wCUintHrhfZ2tL/piJfTZhn4vIJEDC7J+13kELwoTfGT7qpfUP5iBWaW9n+tI6+vG4d1SgzQOgjtB+UrbdSMC+RNuler8ZsBJFaSDjyQ+2mBjFyPpsfAgL6QKBgQDLapGitNcOSzhC6y97Q46HOZWk03CWHH0n90cBJ68zcTuRmOLOlowUosBXUacffxF4Qjik536Ttnrks53mNEur0BKcTdnWUu670RSrSGlvSu5wjLOUfDDUmTvw6Hfn+z8kUC1ftmRjLgK6Qs9Cjp68R1OW0mOgy9M9vwQsSyOsEQKBgQCm0lciY/Q9X3olFGoUrn/38RpNWdIKTs7NzB5lMKSV17jCCzWhi/TTOyczfiPoRuZi56enJr2AY3pUY+dzn8YZ9ZhrVqv2feDTZCzXzEmbEhcx9KWJQi0wEm4o5+szbpABF/CMwfQEiKLA7W+DHeG4NTFUtTSjxG1LvwdoEK2aSQKBgQC1nlopQkZVft+CzFaPswwSV9oL/t7RWvSW5j0iP16IY/iyvUupuyVjpbSZmUXkqspRYp47AVKna65B1BZbyyasMcQ4UyyhmV4INZcs5ojEA4sfsw7RCVoGx7Qfh9sev/y9HGOgcUXjmsJ87Ed3dwtJQMMraDK4IGJmDGSKHWQVHw==-----END PRIVATE KEY-----",
	"RS256",
);

const clientProvider = new MemoryClientProvider([
	new Client(
		"hello-world",
		"Hello World",
		["http://localhost:8080/", "https://hello-world.baseless.dev/"],
		"RS256",
		publicKey,
		privateKey,
		{
			passwordReset: {
				en: (ctx, { code, email }) => ({
					subject: "Email validation",
					text: `Hello,

					Follow this link to reset your ${ctx.client.principal} password for your account.
					
					http://localhost:8080/?action=pwreset&code=${code}&email=${email}
					
					If you didn’t ask to reset your password, you can ignore this email.
					
					Thanks,
					
					Your ${ctx.client.principal} team`.replace(/($\t*|(?<=\n)\t*)/g, ""),
				}),
			},
			validation: {
				en: (ctx, { code, email }) => ({
					subject: "Email validation",
					text: `Hello,

					Follow this link to verify your email address.
					
					http://localhost:8080/?action=validate&code=${code}&email=${email}
					
					If you didn’t ask to verify this address, you can ignore this email.
					
					Thanks,
					
					Your ${ctx.client.principal} team`.replace(/($\t*|(?<=\n)\t*)/g, ""),
				}),
			},
		},
	),
]);

const kvProvider = new SqliteKVProvider("kv.db");
const kvBackendAuth = new SqliteKVProvider("auth.db");
const kvBackendDb = new SqliteKVProvider("db.db");
const authProvider = new AuthOnKvProvider(kvBackendAuth);
const databaseProvider = new DatabaseOnKvProvider(kvBackendDb);
const mailProvider = new LoggerMailProvider();

await kvProvider.open();
await kvBackendAuth.open();
await kvBackendDb.open();

const server = new Server(
	auth.build(),
	database.build(),
	functions.build(),
	mail.build(),
	clientProvider,
	authProvider,
	kvProvider,
	databaseProvider,
	mailProvider,
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

await kvProvider.close();
await kvBackendAuth.close();
await kvBackendDb.close();
