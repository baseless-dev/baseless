import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import {
	oneOf,
	sequence,
} from "../../common/auth/ceremony/component/helpers.ts";
import { config } from "../../common/server/config/config.ts";
import {
	createConsoleLogHandler,
	setGlobalLogHandler,
} from "../../common/system/logger.ts";
import { DenoFSAssetProvider } from "../../providers/asset-denofs/mod.ts";
import EmailAuthentificationComponent from "../../providers/auth-email/mod.ts";
import OTPLoggerAuthentificationComponent from "../../providers/auth-otp-logger/mod.ts";
import PasswordAuthentificationComponent from "../../providers/auth-password/mod.ts";
import TOTPAuthentificationComponent from "../../providers/auth-totp/mod.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { DenoKVDocumentProvider } from "../../providers/document-denokv/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity-document/mod.ts";
import { DenoKVProvider } from "../../providers/kv-denokv/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import { KVSessionProvider } from "../../providers/session-kv/mod.ts";
import { Server } from "../../server/server.ts";
import { autoid } from "../../common/system/autoid.ts";
import { generateKey } from "../../common/system/otp.ts";
import GithubAuthentificationIdenticator from "../../providers/auth-oauth2/github.ts";
import GoogleAuthentificationIdenticator from "../../providers/auth-oauth2/google.ts";

setGlobalLogHandler(createConsoleLogHandler());

const { publicKey, privateKey } = await generateKeyPair("PS512");

const dbKv = await Deno.openKv("./db/kv.db");
const dbDocument = await Deno.openKv("./db/document.db");
const dbSession = await Deno.openKv("./db/session.db");
const assetProvider = new DenoFSAssetProvider("file://./public");
const counterProvider = new MemoryCounterProvider();
const kvProvider = new DenoKVProvider(dbKv);
const documentProvider = new DenoKVDocumentProvider(dbDocument);
const identityProvider = new DocumentIdentityProvider(documentProvider);
const sessionProvider = new KVSessionProvider(new DenoKVProvider(dbSession));

const emailIdenticator = new EmailAuthentificationComponent(
	"email",
	new LoggerMessageProvider(),
);
const passwordComponent = new PasswordAuthentificationComponent(
	"password",
	"lesalt",
);
const otpComponent = new OTPLoggerAuthentificationComponent("otp", {
	digits: 6,
});
const totpComponent = new TOTPAuthentificationComponent("totp", {
	digits: 6,
	period: 60,
});
const githubIdenticator = new GithubAuthentificationIdenticator("github", {
	clientId: Deno.env.get("GITHUB_CLIENT_ID") ?? "",
	clientSecret: Deno.env.get("GITHUB_CLIENT_SECRET") ?? "",
	redirectUrl: "http://localhost:8080/login",
});
const googleIdenticator = new GoogleAuthentificationIdenticator("google", {
	clientId: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
	clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
	redirectUrl: "http://localhost:8080/login",
});

const email = emailIdenticator.getCeremonyComponent();
const password = passwordComponent.getCeremonyComponent();
const otp = otpComponent.getCeremonyComponent();
const totp = totpComponent.getCeremonyComponent();
const github = githubIdenticator.getCeremonyComponent();
const google = googleIdenticator.getCeremonyComponent();
config.auth()
	.setEnabled(true)
	.setSecurityKeys({ publicKey, privateKey, algo: "PS512" })
	.setSecuritySalt(autoid())
	.setCeremony(sequence(
		oneOf(
			github,
			google,
			sequence(email, password),
		),
		oneOf(otp, totp),
	))
	// .setCeremony(oneOf(
	// 	github,
	// 	google,
	// 	sequence(email, password, oneOf(otp, totp)),
	// ))
	.addComponent(emailIdenticator)
	.addComponent(githubIdenticator)
	.addComponent(googleIdenticator)
	.addComponent(passwordComponent)
	.addComponent(otpComponent)
	.addComponent(totpComponent);

if (
	await identityProvider.getByIdentification("email", "john@doe").catch((_) =>
		null
	) === null
) {
	await identityProvider.create(
		{ displayName: "John Doe" },
		{
			email: {
				id: "email",
				identification: "john@doe",
				confirmed: true,
				meta: {},
			},
			github: {
				id: "github",
				identification: "2616923",
				confirmed: true,
				meta: {},
			},
			google: {
				id: "google",
				identification: "117789756285416284892",
				confirmed: true,
				meta: {},
			},
			password: {
				id: "password",
				confirmed: true,
				...await passwordComponent.getIdentityComponentMeta(
					// deno-lint-ignore no-explicit-any
					{ value: "123", context: {} as any },
				),
			},
			otp: {
				id: "otp",
				meta: {},
				confirmed: true,
			},
			totp: {
				id: "totp",
				confirmed: true,
				...await totpComponent.getIdentityComponentMeta(
					// deno-lint-ignore no-explicit-any
					{ value: generateKey(), context: {} as any },
				),
			},
		},
	);
}

const server = new Server({
	configuration: config.build(),
	assetProvider,
	counterProvider,
	identityProvider,
	sessionProvider,
	kvProvider,
	documentProvider,
});

const abortController = new AbortController();

Deno.addSignalListener("SIGTERM", () => {
	abortController.abort();
});

await Deno.serve({
	port: 8081,
	hostname: "localhost",
	signal: abortController.signal,
}, async (req, info) => {
	const [res, _] = await server.handleRequest(req, info.remoteAddr.hostname);
	res.headers.set("Access-Control-Allow-Origin", "*");
	return res;
});
