import type { IdentityContext } from "../plugins/identity/context.ts";
import type { KVContext } from "../plugins/kv/context.ts";
import type { SessionContext } from "../plugins/session/context.ts";
import type { AuthenticationContext } from "../plugins/authentication/context.ts";
import type { AssetContext } from "../plugins/asset/context.ts";
import { AuthenticationConfiguration } from "../plugins/authentication/configuration.ts";
import { Application } from "../lib/application/application.ts";
import { MemoryAssetProvider } from "../providers/asset-memory/mod.ts";
import OTPMemoryAuthentificationProvider from "../providers/auth-otp-memory/mod.ts";
import TOTPAuthentificationProvider from "../providers/auth-totp/mod.ts";
import PasswordAuthentificationProvider from "../providers/auth-password/mod.ts";
import EmailAuthentificationProvider from "../providers/auth-email/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { MemoryDocumentProvider } from "../providers/document-memory/mod.ts";
import { DocumentIdentityProvider } from "../providers/identity-document/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { MemoryNotificationProvider } from "../providers/notification-memory/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { generateKeyPair } from "npm:jose@5.2.0";
import asset from "../plugins/asset/mod.ts";
import kv from "../plugins/kv/mod.ts";
import counter from "../plugins/counter/mod.ts";
import identity from "../plugins/identity/mod.ts";
import session from "../plugins/session/mod.ts";
import authentication from "../plugins/authentication/mod.ts";
import openapi from "../plugins/openapi/mod.ts";
import { sequence } from "../lib/authentication/types.ts";

export type BuilderOptions = {
	counterProvider: MemoryCounterProvider;
	kvProvider: MemoryKVProvider;
	documentProvider: MemoryDocumentProvider;
	assetProvider: MemoryAssetProvider;
	identityProvider: DocumentIdentityProvider;
	sessionProvider: KVSessionProvider;
	notificationProvider: MemoryNotificationProvider;
	authenticationConfiguration: AuthenticationConfiguration;
	emailProvider: EmailAuthentificationProvider;
	passwordProvider: PasswordAuthentificationProvider;
	otpProvider: OTPMemoryAuthentificationProvider;
	totpProvider: TOTPAuthentificationProvider;
};
export type BuilderResult = {
	authenticationConfiguration?: AuthenticationConfiguration;
};

export type MockResult = {
	router: Application<
		& AuthenticationContext
		& AssetContext
		& IdentityContext
		& KVContext
		& SessionContext
	>;
} & BuilderOptions;

let cachedKeys: Awaited<ReturnType<typeof generateKeyPair>> | undefined;

export async function mock(): Promise<MockResult>;
export async function mock(
	builder: (options: BuilderOptions) => BuilderResult | Promise<BuilderResult>,
): Promise<MockResult>;
export async function mock(
	builder?: (options: BuilderOptions) => BuilderResult | Promise<BuilderResult>,
): Promise<MockResult> {
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const documentProvider = new MemoryDocumentProvider();
	const assetProvider = new MemoryAssetProvider();
	const identityProvider = new DocumentIdentityProvider(
		new MemoryDocumentProvider(),
	);
	const sessionProvider = new KVSessionProvider(new MemoryKVProvider());
	const notificationProvider = new MemoryNotificationProvider();
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
	const otpProvider = new OTPMemoryAuthentificationProvider(
		"otp",
		{
			digits: 6,
		},
	);
	const totpProvider = new TOTPAuthentificationProvider("totp", {
		digits: 6,
		period: 60,
	});
	cachedKeys ??= await generateKeyPair("PS512");
	const keys = { ...cachedKeys, algo: "PS512" };
	let authenticationConfiguration = new AuthenticationConfiguration()
		.setKeys(keys)
		.setSalt("lesalt")
		.setAuthenticationProviders([
			emailProvider,
			passwordProvider,
			otpProvider,
			totpProvider,
		])
		.setAuthenticationCeremony(
			sequence(
				emailProvider.toCeremonyComponent(),
				passwordProvider.toCeremonyComponent(),
			),
		);

	const options: BuilderOptions = {
		counterProvider,
		kvProvider,
		documentProvider,
		assetProvider,
		identityProvider,
		sessionProvider,
		notificationProvider,
		authenticationConfiguration,
		emailProvider,
		passwordProvider,
		otpProvider,
		totpProvider,
	};
	const result = await builder?.(options) ?? {};
	if (result.authenticationConfiguration) {
		authenticationConfiguration = result.authenticationConfiguration;
	}
	const router = new Application()
		.use(asset((config) => config.setAssetProvider(assetProvider)))
		.use(kv((config) => config.setKVProvider(kvProvider)))
		.use(counter((config) => config.setCounterProvider(counterProvider)))
		.use(identity((config) => config.setIdentityProvider(identityProvider)))
		.use(session((config) => config.setSessionProvider(sessionProvider)))
		.use(authentication(authenticationConfiguration))
		.use(openapi());
	return {
		...options,
		router,
	};
}

export default mock;
