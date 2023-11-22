import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/runtime/generate.ts";
import { ConfigurationBuilder } from "../common/server/config/config.ts";
import { MemoryAssetProvider } from "../providers/asset-memory/mod.ts";
import EmailAuthentificationIdenticator from "../providers/auth-email/mod.ts";
import PasswordAuthentificationChallenger from "../providers/auth-password/mod.ts";
import OTPLoggerAuthentificationChallenger from "../providers/auth-otp-logger/mod.ts";
import TOTPAuthentificationChallenger from "../providers/auth-totp/mod.ts";
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
import { MemoryDocumentProvider } from "../providers/document-memory/mod.ts";
import type {
	AuthenticationCeremonyComponentChallenge,
	AuthenticationCeremonyComponentIdentification,
} from "../common/auth/ceremony/ceremony.ts";
import {
	importPKCS8,
	importSPKI,
} from "https://deno.land/x/jose@v4.13.1/key/import.ts";
import {
	exportPKCS8,
	exportSPKI,
} from "https://deno.land/x/jose@v4.13.1/key/export.ts";

export type DummyServerHelpers = {
	config: ConfigurationBuilder;
	email: AuthenticationCeremonyComponentIdentification;
	emailIdenticator: EmailAuthentificationIdenticator;
	password: AuthenticationCeremonyComponentChallenge;
	passwordChallenger: PasswordAuthentificationChallenger;
	otp: AuthenticationCeremonyComponentChallenge;
	otpChallenger: OTPLoggerAuthentificationChallenger;
	totp: AuthenticationCeremonyComponentChallenge;
	totpChallenger: TOTPAuthentificationChallenger;
	createIdentity: DocumentIdentityProvider["create"];
	generateKeyPair: typeof generateKeyPair;
	importPKCS8: typeof importPKCS8;
	importSPKI: typeof importSPKI;
	exportPKCS8: typeof exportPKCS8;
	exportSPKI: typeof exportSPKI;
} & typeof h;

export type DummyServerResult = {
	server: Server;
	email: AuthenticationCeremonyComponentIdentification;
	emailIdenticator: EmailAuthentificationIdenticator;
	password: AuthenticationCeremonyComponentChallenge;
	passwordChallenger: PasswordAuthentificationChallenger;
	otp: AuthenticationCeremonyComponentChallenge;
	otpChallenger: OTPLoggerAuthentificationChallenger;
	totp: AuthenticationCeremonyComponentChallenge;
	totpChallenger: TOTPAuthentificationChallenger;
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
	const assetProvider = new MemoryAssetProvider();
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const documentProvider = new MemoryDocumentProvider();
	const identityDocument = new MemoryDocumentProvider();
	const identityProvider = new DocumentIdentityProvider(identityDocument);
	const sessionKV = new MemoryKVProvider();
	const sessionProvider = new KVSessionProvider(sessionKV);
	const email: AuthenticationCeremonyComponentIdentification = {
		kind: "identification",
		id: "email",
		prompt: "email",
	};
	const emailIdenticator = new EmailAuthentificationIdenticator(
		new LoggerMessageProvider(),
	);
	const password: AuthenticationCeremonyComponentChallenge = {
		kind: "challenge",
		id: "password",
		prompt: "password",
	};
	const passwordChallenger = new PasswordAuthentificationChallenger();
	const otp: AuthenticationCeremonyComponentChallenge = {
		kind: "challenge",
		id: "otp",
		prompt: "otp",
		digits: 6,
	};
	const otpChallenger = new OTPLoggerAuthentificationChallenger({ digits: 6 });
	const totp: AuthenticationCeremonyComponentChallenge = {
		kind: "challenge",
		id: "totp",
		prompt: "totp",
		digits: 6,
		timeout: 60,
	};
	const totpChallenger = new TOTPAuthentificationChallenger({
		digits: 6,
		period: 60,
	});

	config.auth()
		.addIdenticator("email", emailIdenticator)
		.addChallenger("password", passwordChallenger)
		.addChallenger("otp", otpChallenger)
		.addChallenger("totp", totpChallenger);

	const helpers: DummyServerHelpers = {
		config,
		...h,
		email,
		emailIdenticator,
		password,
		passwordChallenger,
		otp,
		otpChallenger,
		totp,
		totpChallenger,
		createIdentity: (meta, identifications, challenges) =>
			identityProvider.create(meta, identifications, challenges),
		generateKeyPair,
		importPKCS8,
		importSPKI,
		exportPKCS8,
		exportSPKI,
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
			documentProvider,
		}),
		email,
		emailIdenticator,
		password,
		passwordChallenger,
		otp,
		otpChallenger,
		totp,
		totpChallenger,
		assetProvider,
		counterProvider,
		identityProvider,
		sessionProvider,
	};
}
