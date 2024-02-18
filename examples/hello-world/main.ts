import {
	createConsoleLogHandler,
	LogLevel,
	setGlobalLogHandler,
} from "../../lib/logger.ts";
import openapiPlugin from "../../plugins/openapi/mod.ts";
import EmailAuthentificationComponent from "../../providers/auth-email/mod.ts";
import OTPMessageAuthentificationComponent from "../../providers/auth-otp-message/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import { mock, t } from "../../server/mock.ts";

setGlobalLogHandler(createConsoleLogHandler(LogLevel.DEBUG));

const {
	router,
} = await mock(async ({
	providers: { identity, kv },
	components: { password, sequence, oneOf },
}) => {
	const message = new LoggerMessageProvider();
	const email = new EmailAuthentificationComponent(
		"email",
		identity,
		kv,
		message,
	);
	const otp = new OTPMessageAuthentificationComponent(
		"otp",
		{
			digits: 6,
		},
		kv,
		message,
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
	return {
		auth: {
			providers: [
				email,
				password,
				otp,
			],
			ceremony: sequence(
				email.toCeremonyComponent(),
				password.toCeremonyComponent(),
				otp.toCeremonyComponent(),
			),
			accessTokenTTL: 1000 * 60 * 60 * 10,
			refreshTokenTTL: 1000 * 60 * 60 * 24 * 7,
		},
	};
});
const app = router
	.use(openapiPlugin({
		info: {
			title: "Hello World Documentation",
			version: "0.0.1",
		},
	}))
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
