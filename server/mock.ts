import { generateKeyPair } from "npm:jose@5.2.0";
import { MemoryAssetProvider } from "../providers/asset-memory/mod.ts";
import PasswordAuthentificationProvider from "../providers/auth-password/mod.ts";
import EmailAuthentificationProvider from "../providers/auth-email/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { MemoryDocumentProvider } from "../providers/document-memory/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { DocumentIdentityProvider } from "../providers/identity-document/mod.ts";
import counter from "../plugins/counter/mod.ts";
import kv from "../plugins/kv/mod.ts";
import authentication from "../plugins/authentication/mod.ts";
import registration from "../plugins/registration/mod.ts";
import openapi from "../plugins/openapi/mod.ts";
import asset from "../plugins/asset/mod.ts";
import TOTPAuthentificationProvider from "../providers/auth-totp/mod.ts";
import { oneOf, sequence } from "../lib/authentication/types.ts";
import { Router } from "../lib/router/router.ts";
import { MemoryNotificationProvider } from "../providers/notification-memory/mod.ts";
import type { Context as AuthenticationContext } from "../plugins/authentication/context.ts";
import type { Context as RegistrationContext } from "../plugins/registration/context.ts";
import type { Context as AssetContext } from "../plugins/asset/context.ts";
import OTPMemoryAuthentificationProvider from "../providers/auth-otp-memory/mod.ts";
import { AuthenticationConfiguration } from "../plugins/authentication/configuration.ts";

export type MockResult = {
	router: Router<AuthenticationContext & RegistrationContext & AssetContext>;
	providers: {
		kv: MemoryKVProvider;
		document: MemoryDocumentProvider;
		asset: MemoryAssetProvider;
		identity: DocumentIdentityProvider;
		session: KVSessionProvider;
		notification: MemoryNotificationProvider;
	};
	components: {
		email: EmailAuthentificationProvider;
		password: PasswordAuthentificationProvider;
		otp: OTPMemoryAuthentificationProvider;
		totp: TOTPAuthentificationProvider;
		oneOf: typeof oneOf;
		sequence: typeof sequence;
	};
};

export type BuilderResult = {
	providers?: Partial<MockResult["providers"]>;
	auth?: AuthenticationConfiguration;
};

export async function mock(): Promise<MockResult>;
export async function mock(
	builder: (
		result: Omit<MockResult, "router">,
	) => void | BuilderResult | Promise<void | BuilderResult>,
): Promise<MockResult>;
export async function mock(
	builder?: (
		result: Omit<MockResult, "router">,
	) => void | BuilderResult | Promise<void | BuilderResult>,
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
	const email = new EmailAuthentificationProvider(
		"email",
		identityProvider,
		kvProvider,
		notificationProvider,
	);
	const password = new PasswordAuthentificationProvider(
		"password",
		"lesalt",
	);
	const otp = new OTPMemoryAuthentificationProvider(
		"otp",
		{
			digits: 6,
		},
	);
	const totp = new TOTPAuthentificationProvider("totp", {
		digits: 6,
		period: 60,
	});
	const result = {
		providers: {
			kv: kvProvider,
			document: documentProvider,
			asset: assetProvider,
			identity: identityProvider,
			session: sessionProvider,
			notification: notificationProvider,
		},
		components: {
			email,
			password,
			otp,
			totp,
			oneOf,
			sequence,
		},
	};
	const keys = { ...await generateKeyPair("PS512"), algo: "PS512" };
	const { auth } = await builder?.(result) ?? {};
	let authConfig = auth ?? new AuthenticationConfiguration();
	authConfig = authConfig
		.setIdentityProvider(identityProvider)
		.setSessionProvider(sessionProvider)
		.setKeys(keys)
		.setSalt("lesalt")
		.setAuthenticationProviders([email, password])
		.setCeremony(
			sequence(
				email.toCeremonyComponent(),
				password.toCeremonyComponent(),
			),
		);

	const router = new Router()
		.use(asset((config) => config.setAssetProvider(assetProvider)))
		.use(kv((config) => config.setKVProvider(kvProvider)))
		.use(counter((config) => config.setCounterProvider(counterProvider)))
		.use(authentication(authConfig))
		.use(openapi());
	// .use(
	// 	"/api/registration",
	// 	registrationPlugin({
	// 		counterProvider,
	// 		identityProvider,
	// 		sessionProvider,
	// 		keys,
	// 		providers: [email, password],
	// 		ceremony: sequence(
	// 			email.toCeremonyComponent(),
	// 			password.toCeremonyComponent(),
	// 		),
	// 		...auth,
	// 	}),
	// )
	return {
		...result,
		router,
	};
}

export default mock;
