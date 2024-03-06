import {
	createConsoleLogHandler,
	LogLevel,
	setGlobalLogHandler,
} from "../../lib/logger.ts";
import { Router } from "../../lib/router/router.ts";
import openapi from "../../plugins/openapi/mod.ts";
import OTPLoggerAuthentificationProvider from "../../providers/auth-otp-logger/mod.ts";
import EmailAuthentificationProvider from "../../providers/auth-email/mod.ts";
import PasswordAuthentificationProvider from "../../providers/auth-password/mod.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { MemoryDocumentProvider } from "../../providers/document-memory/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity-document/mod.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { LoggerNotificationProvider } from "../../providers/notification-logger/mod.ts";
import { KVSessionProvider } from "../../providers/session-kv/mod.ts";
import authenticationPlugin from "../../plugins/authentication/mod.ts";
import registrationPlugin from "../../plugins/registration/mod.ts";
import { generateKeyPair } from "npm:jose@5.2.0";
import { t } from "../../lib/typebox.ts";
import { oneOf, sequence } from "../../lib/authentication/types.ts";

setGlobalLogHandler(createConsoleLogHandler(LogLevel.DEBUG));

const counter = new MemoryCounterProvider();
const kv = new MemoryKVProvider();
const identity = new DocumentIdentityProvider(new MemoryDocumentProvider());
const session = new KVSessionProvider(new MemoryKVProvider());
const notification = new LoggerNotificationProvider();
const email = new EmailAuthentificationProvider(
	"email",
	identity,
	kv,
	notification,
);
const password = new PasswordAuthentificationProvider(
	"password",
	"lesalt",
);
const otp = new OTPLoggerAuthentificationProvider(
	"otp",
	{
		digits: 6,
	},
	kv,
);

await identity.create({
	displayName: "John Doe",
}, [{
	id: "email",
	...await email.configureIdentityComponent("john@test.local"),
	confirmed: true,
}, {
	id: "password",
	...await password.configureIdentityComponent("123"),
}, {
	id: "otp",
	...await otp.configureIdentityComponent(""),
}]);
const keys = { ...await generateKeyPair("PS512"), algo: "PS512" };

const app = new Router()
	.use(
		"/api/authentication",
		authenticationPlugin({
			counter,
			identity,
			session,
			kv,
			keys,
			salt: "lesalt",
			providers: [
				email,
				password,
				otp,
			],
			ceremony: sequence(
				email.toCeremonyComponent(),
				otp.toCeremonyComponent(),
				password.toCeremonyComponent(),
			),
			accessTokenTTL: 1000 * 60 * 60 * 10,
			refreshTokenTTL: 1000 * 60 * 60 * 24 * 7,
		}),
	)
	.use(
		"/api/registration",
		registrationPlugin({
			counter,
			identity,
			session,
			keys,
			providers: [
				email,
				password,
				otp,
			],
			ceremony: sequence(
				email.toCeremonyComponent(),
				oneOf(
					password.toCeremonyComponent(),
					otp.toCeremonyComponent(),
				),
			),
			accessTokenTTL: 1000 * 60 * 60 * 10,
			refreshTokenTTL: 1000 * 60 * 60 * 24 * 7,
		}),
	)
	.use(openapi((config) =>
		config
			.setInfo({
				title: "Hello World Documentation",
				version: "0.0.1",
			})
	))
	.get(
		"/api/v1/hello/{world}",
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
	// const waitUntil: PromiseLike<void>[] = [];
	const res = await handle(req);
	res.headers.set(
		"Access-Control-Allow-Origin",
		req.headers.get("Origin") ?? "*",
	);
	return res;
});
