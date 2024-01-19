import { h, Router, t } from "../../server/mod.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { DenoFSAssetProvider } from "../../providers/asset-denofs/mod.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { DenoKVDocumentProvider } from "../../providers/document-denokv/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity-document/mod.ts";
import { DenoKVProvider } from "../../providers/kv-denokv/mod.ts";
import { KVSessionProvider } from "../../providers/session-kv/mod.ts";
import openapiPlugin from "../../plugins/openapi/mod.ts";
import corePlugin from "../../plugins/baseless/mod.ts";
import authPlugin from "../../plugins/auth/mod.ts";
import assetPlugin from "../../plugins/asset/mod.ts";
import EmailAuthentificationComponent from "../../providers/auth-email/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import PasswordAuthentificationComponent from "../../providers/auth-password/mod.ts";

const dbKv = await Deno.openKv("./db/kv.db");
const dbDocument = await Deno.openKv("./db/document.db");
const dbSession = await Deno.openKv("./db/session.db");
const counter = new MemoryCounterProvider();
const kv = new DenoKVProvider(dbKv);
const document = new DenoKVDocumentProvider(dbDocument);
const asset = new DenoFSAssetProvider("./public");
const { publicKey, privateKey } = await generateKeyPair("PS512");
const identity = new DocumentIdentityProvider(document);
const session = new KVSessionProvider(new DenoKVProvider(dbSession));
const emailIdenticator = new EmailAuthentificationComponent(
	"email",
	identity,
	new LoggerMessageProvider(),
);
const passwordComponent = new PasswordAuthentificationComponent(
	"password",
	"lesalt",
);

const app = new Router()
	.use(corePlugin({
		counter,
		document,
		kv,
	}))
	.use(
		"/api/v1/auth",
		authPlugin({
			counter,
			identity,
			session,
			kv,
			keys: { publicKey, privateKey, algo: "PS512" },
			salt: "should probably be a secret more robust than this",
			ceremony: h.sequence(
				emailIdenticator.getCeremonyComponent(),
				passwordComponent.getCeremonyComponent(),
			),
			components: [emailIdenticator, passwordComponent],
		}),
	)
	.use(assetPlugin({
		asset,
	}))
	.use(openapiPlugin({
		title: "Hello World Documentation",
		version: "0.0.1",
	}, {
		tags: ["Debug"],
	}))
	.get(
		"/api/v1/hello/{world}",
		({ params, query }) =>
			new Response(
				`Hello, ${decodeURIComponent(params.world)}${query.exclamation ?? "!"}`,
			),
		{
			summary: "Hello World",
			description: "Says hello to the world.",
			params: t.Object(
				{ world: t.Describe("The placeholder", t.String()) },
				["world"],
			),
			query: t.Object(
				{
					exclamation: t.Referenceable(
						"ExclamationMark",
						t.Describe("The exclamation mark", t.String()),
					),
				},
			),
			response: {
				200: {
					description: "La salutation",
					content: {
						"text/plain": {
							schema: t.Describe("La salutation", t.String()),
						},
					},
				},
			},
		},
	);

const handle = await app.build();

const abortController = new AbortController();

Deno.addSignalListener("SIGTERM", () => {
	abortController.abort();
});

await Deno.serve({
	port: 8081,
	hostname: "localhost",
	signal: abortController.signal,
}, async (req, info) => {
	const waitUntil: PromiseLike<void>[] = [];
	const res = await handle(req, { waitUntil });
	res.headers.set(
		"Access-Control-Allow-Origin",
		req.headers.get("Origin") ?? "*",
	);
	return res;
});
