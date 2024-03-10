import {
	createConsoleLogHandler,
	LogLevel,
	setGlobalLogHandler,
} from "../../lib/logger.ts";
import {
	Application,
	authentication,
	AuthenticationConfiguration,
	counter,
	EmailAuthentificationProvider,
	identity,
	kv,
	PasswordAuthentificationProvider,
	sequence,
	session,
	t,
} from "../../prelude.ts";
import OTPLoggerAuthentificationProvider from "../../providers/auth-otp-logger/mod.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { MemoryDocumentProvider } from "../../providers/document-memory/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity-document/mod.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { LoggerNotificationProvider } from "../../providers/notification-logger/mod.ts";
import { KVSessionProvider } from "../../providers/session-kv/mod.ts";
import { generateKeyPair } from "npm:jose@5.2.0";
import openapi from "../../plugins/openapi/mod.ts";

setGlobalLogHandler(createConsoleLogHandler(LogLevel.DEBUG));

const counterProvider = new MemoryCounterProvider();
const kvProvider = new MemoryKVProvider();
const identityProvider = new DocumentIdentityProvider(
	new MemoryDocumentProvider(),
);
const sessionProvider = new KVSessionProvider(new MemoryKVProvider());
const notificationProvider = new LoggerNotificationProvider();
const emailProvider = new EmailAuthentificationProvider(
	"email",
	identityProvider,
	kvProvider,
	notificationProvider,
);
const passwordProvider = new PasswordAuthentificationProvider(
	"password",
	"lesalt",
);
const otpProvider = new OTPLoggerAuthentificationProvider(
	"otp",
	{
		digits: 6,
	},
	kvProvider,
);

await identityProvider.create({
	displayName: "John Doe",
}, [{
	id: "email",
	...await emailProvider.configureIdentityComponent("john@test.local"),
	confirmed: true,
}, {
	id: "password",
	...await passwordProvider.configureIdentityComponent("123"),
}, {
	id: "otp",
	...await otpProvider.configureIdentityComponent(""),
}]);
const keys = { ...await generateKeyPair("PS512"), algo: "PS512" };

const authenticationConfiguration = new AuthenticationConfiguration()
	.setKeys(keys)
	.setSalt("lesalt")
	.setAuthenticationProviders([
		emailProvider,
		passwordProvider,
		otpProvider,
	])
	.setAuthenticationCeremony(
		sequence(
			emailProvider.toCeremonyComponent(),
			passwordProvider.toCeremonyComponent(),
			otpProvider.toCeremonyComponent(),
		),
	);

const app = new Application()
	.use(kv((config) => config.setKVProvider(kvProvider)))
	.use(counter((config) => config.setCounterProvider(counterProvider)))
	.use(identity((config) => config.setIdentityProvider(identityProvider)))
	.use(session((config) => config.setSessionProvider(sessionProvider)))
	.use(authentication(authenticationConfiguration))
	.use(openapi())
	.get(
		"hello/{world}",
		({ params, query }) =>
			new Response(
				`Hello, ${decodeURIComponent(params.world)}${query.exclamation ?? "!"}`,
			),
		{
			detail: {
				summary: "Hello World",
				description: "Says hello to the world.",
			},
			params: t.Object(
				{ world: t.String({ description: "The placeholder" }) },
				["world"],
			),
			query: t.Object(
				{
					exclamation: t.Optional(t.String({
						$id: "ExclamationMark",
						description: "The exclamation mark",
					})),
				},
			),
			response: {
				200: {
					content: {
						"text/plain": {
							schema: t.String({ description: "The greeting" }),
						},
					},
				},
			},
		},
	);

/*

.on("authentication:register", async ({ document }) => {})
.on("authentication:sign-in", async ({ document }) => {})
.on("authentication:sign-out", async ({ document }) => {})
.on("authentication:rate-limited", async ({ document }) => {})

*/

const handle = await app.build();

const abortController = new AbortController();
Deno.addSignalListener("SIGTERM", () => {
	abortController.abort();
});

await Deno.serve({
	port: 8081,
	hostname: "localhost",
	signal: abortController.signal,
}, async (req, _info) => {
	const res = await handle(req);
	res.headers.set(
		"Access-Control-Allow-Origin",
		req.headers.get("Origin") ?? "*",
	);
	return res;
});
