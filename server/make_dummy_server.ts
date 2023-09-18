import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/runtime/generate.ts";
import { ConfigurationBuilder } from "../common/server/config/config.ts";
import { MemoryAssetProvider } from "../providers/asset-memory/mod.ts";
import { EmailAuthentificationIdenticator } from "../providers/auth-email/mod.ts";
import { PasswordAuthentificationChallenger } from "../providers/auth-password/mod.ts";
import { OTPLoggerAuthentificationChallenger } from "../providers/auth-otp-logger/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { DocumentIdentityProvider } from "../providers/identity-document/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { LoggerMessageProvider } from "../providers/message-logger/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { Server } from "./server.ts";
import * as h from "../common/auth/ceremony/component/helpers.ts";
import type { AssetProvider } from "../providers/asset.ts";
import type { CounterProvider } from "../providers/counter.ts";
import type { IdentityProvider } from "../providers/identity.ts";
import type { SessionProvider } from "../providers/session.ts";
import { TOTPAuthentificationChallenger } from "../providers/auth-totp/mod.ts";
import { MemoryDocumentProvider } from "../providers/document-memory/mod.ts";

export type DummyServerHelpers = {
	config: ConfigurationBuilder;
	email: ReturnType<typeof EmailAuthentificationIdenticator>;
	password: ReturnType<typeof PasswordAuthentificationChallenger>;
	otp: ReturnType<typeof OTPLoggerAuthentificationChallenger>;
	totp: ReturnType<typeof TOTPAuthentificationChallenger>;
	createIdentity: DocumentIdentityProvider["create"];
	createIdentification: DocumentIdentityProvider["createIdentification"];
	createChallenge: DocumentIdentityProvider["createChallenge"];
} & typeof h;

export type DummyServerResult = {
	server: Server;
	email: ReturnType<typeof EmailAuthentificationIdenticator>;
	password: ReturnType<typeof PasswordAuthentificationChallenger>;
	otp: ReturnType<typeof OTPLoggerAuthentificationChallenger>;
	totp: ReturnType<typeof TOTPAuthentificationChallenger>;
	assetProvider: AssetProvider;
	counterProvider: CounterProvider;
	identityProvider: IdentityProvider;
	sessionProvider: SessionProvider;
};

let cachedKeys: Awaited<ReturnType<typeof generateKeyPair>> | undefined;

export default async function makeDummyServer(): Promise<DummyServerResult>;
export default async function makeDummyServer(
	configurator: (helpers: DummyServerHelpers) => void | Promise<void>,
): Promise<DummyServerResult>;
export default async function makeDummyServer(
	configurator?: (helpers: DummyServerHelpers) => void | Promise<void>,
): Promise<DummyServerResult> {
	const config = new ConfigurationBuilder();
	if (!cachedKeys) {
		cachedKeys = await generateKeyPair("PS512");
	}
	const { publicKey, privateKey } = cachedKeys;
	config.auth()
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar");

	const assetProvider = new MemoryAssetProvider();
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const identityDocument = new MemoryDocumentProvider();
	const identityProvider = new DocumentIdentityProvider(identityDocument);
	const sessionKV = new MemoryKVProvider();
	const sessionProvider = new KVSessionProvider(sessionKV);
	const email = EmailAuthentificationIdenticator(
		"email",
		new LoggerMessageProvider(),
	);
	const password = PasswordAuthentificationChallenger("password");
	const otp = OTPLoggerAuthentificationChallenger("otp", { digits: 6 });
	const totp = TOTPAuthentificationChallenger("totp", {
		digits: 6,
		period: 60,
	});

	const helpers: DummyServerHelpers = {
		config,
		...h,
		email,
		password,
		otp,
		totp,
		createIdentity: (meta) => identityProvider.create(meta),
		createIdentification: (identityIdentification) =>
			identityProvider.createIdentification(identityIdentification),
		createChallenge: (identityChallenge) =>
			identityProvider.createChallenge(identityChallenge),
	};

	await configurator?.(helpers);

	return {
		server: new Server({
			configuration: config.build(),
			assetProvider,
			counterProvider,
			identityProvider,
			sessionProvider,
			kvProvider,
		}),
		email,
		password,
		otp,
		totp,
		assetProvider,
		counterProvider,
		identityProvider,
		sessionProvider,
	};
}
