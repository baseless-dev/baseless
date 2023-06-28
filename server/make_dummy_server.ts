import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/runtime/generate.ts";
import { ConfigurationBuilder } from "../common/server/config/config.ts";
import { MemoryAssetProvider } from "../providers/asset-memory/mod.ts";
import { EmailAuthentificationIdenticator } from "../providers/auth-email/mod.ts";
import { PasswordAuthentificationChallenger } from "../providers/auth-password/mod.ts";
import { TOTPLoggerAuthentificationChallenger } from "../providers/auth-totp-logger/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { KVIdentityProvider } from "../providers/identity-kv/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { LoggerMessageProvider } from "../providers/message-logger/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { Server } from "./server.ts";
import * as h from "../common/auth/ceremony/component/helpers.ts";
import { AssetProvider } from "../providers/asset.ts";
import { CounterProvider } from "../providers/counter.ts";
import { IdentityProvider } from "../providers/identity.ts";
import { SessionProvider } from "../providers/session.ts";

export type DummyServerHelpers = {
	config: ConfigurationBuilder;
	email: EmailAuthentificationIdenticator;
	password: PasswordAuthentificationChallenger;
	totp: TOTPLoggerAuthentificationChallenger;
	createIdentity: KVIdentityProvider["create"];
	createIdentification: KVIdentityProvider["createIdentification"];
	createChallenge: KVIdentityProvider["createChallenge"];
} & typeof h;

export type DummyServerResult = {
	server: Server;
	email: EmailAuthentificationIdenticator;
	password: PasswordAuthentificationChallenger;
	totp: TOTPLoggerAuthentificationChallenger;
	assetProvider: AssetProvider;
	counterProvider: CounterProvider;
	identityProvider: IdentityProvider;
	sessionProvider: SessionProvider;
};

export default async function makeDummyServer(): Promise<DummyServerResult>;
export default async function makeDummyServer(
	configurator: (helpers: DummyServerHelpers) => void | Promise<void>,
): Promise<DummyServerResult>;
export default async function makeDummyServer(
	configurator?: (helpers: DummyServerHelpers) => void | Promise<void>,
): Promise<DummyServerResult> {
	const config = new ConfigurationBuilder();
	const { publicKey, privateKey } = await generateKeyPair("PS512");
	config.auth()
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar");

	const assetProvider = new MemoryAssetProvider();
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const identityKV = new MemoryKVProvider();
	const identityProvider = new KVIdentityProvider(identityKV);
	const sessionKV = new MemoryKVProvider();
	const sessionProvider = new KVSessionProvider(sessionKV);
	const email = new EmailAuthentificationIdenticator(
		new LoggerMessageProvider(),
	);
	const password = new PasswordAuthentificationChallenger();
	const totp = new TOTPLoggerAuthentificationChallenger({
		period: 60,
		algorithm: "SHA-256",
		digits: 6,
	});

	const helpers: DummyServerHelpers = {
		config,
		...h,
		email,
		password,
		totp,
		createIdentity: (meta, expiration) =>
			identityProvider.create(meta, expiration),
		createIdentification: (identityIdentification) =>
			identityProvider.createIdentification(identityIdentification),
		createChallenge: (identityChallenge, expiration) =>
			identityProvider.createChallenge(identityChallenge, expiration),
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
		totp,
		assetProvider,
		counterProvider,
		identityProvider,
		sessionProvider,
	};
}
