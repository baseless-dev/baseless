import { Elysia, generateKeyPair } from "../deps.ts";
import { MemoryAssetProvider } from "../providers/asset-memory/mod.ts";
import PasswordAuthentificationComponent from "../providers/auth-password/mod.ts";
import EmailAuthentificationComponent from "../providers/auth-email/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { MemoryDocumentProvider } from "../providers/document-memory/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { LoggerMessageProvider } from "../providers/message-logger/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { DocumentIdentityProvider } from "../providers/identity-document/mod.ts";
import authPlugin from "../plugins/auth/mod.ts";
import assetPlugin from "../plugins/asset/mod.ts";
import OTPLoggerAuthentificationComponent from "../providers/auth-otp-logger/mod.ts";
import TOTPAuthentificationComponent from "../providers/auth-totp/mod.ts";
import type { AuthenticationOptions } from "../plugins/auth/mod.ts";
import { oneOf, sequence } from "../lib/auth/types.ts";

export { t } from "../deps.ts";

export type MockResult = {
	router: Elysia;
	providers: {
		kv: MemoryKVProvider;
		document: MemoryDocumentProvider;
		asset: MemoryAssetProvider;
		identity: DocumentIdentityProvider;
		session: KVSessionProvider;
	};
	components: {
		email: EmailAuthentificationComponent;
		password: PasswordAuthentificationComponent;
		otp: OTPLoggerAuthentificationComponent;
		totp: TOTPAuthentificationComponent;
		oneOf: typeof oneOf;
		sequence: typeof sequence;
	};
};

export type BuilderResult = {
	auth?: Omit<
		AuthenticationOptions,
		"counter" | "kv" | "identity" | "session"
	>;
};

export async function mock(): Promise<MockResult>;
export async function mock(
	builder: (
		result: MockResult,
	) => void | BuilderResult | Promise<void | BuilderResult>,
): Promise<MockResult>;
export async function mock(
	builder?: (
		result: MockResult,
	) => void | BuilderResult | Promise<void | BuilderResult>,
): Promise<MockResult> {
	const counter = new MemoryCounterProvider();
	const kv = new MemoryKVProvider();
	const document = new MemoryDocumentProvider();
	const asset = new MemoryAssetProvider();
	const identity = new DocumentIdentityProvider(new MemoryDocumentProvider());
	const session = new KVSessionProvider(new MemoryKVProvider());
	const email = new EmailAuthentificationComponent(
		"email",
		identity,
		new LoggerMessageProvider(),
	);
	const password = new PasswordAuthentificationComponent(
		"password",
		"lesalt",
	);
	const otp = new OTPLoggerAuthentificationComponent("otp", kv, {
		digits: 6,
	});
	const totp = new TOTPAuthentificationComponent("totp", {
		digits: 6,
		period: 60,
	});
	let router = new Elysia();
	const result = {
		router,
		providers: {
			kv,
			document,
			asset,
			identity,
			session,
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
	const { auth } = await builder?.(result) ?? {};
	router = router
		.use(
			authPlugin({
				counter,
				identity,
				session,
				kv,
				keys: auth?.keys ??
					{ ...await generateKeyPair("PS512"), algo: "PS512" },
				salt: "should probably be a secret more robust than this",
				ceremony: sequence(
					email,
					password,
				),
				...auth,
			}),
		)
		.use(assetPlugin({
			asset,
		}));
	return {
		...result,
		router,
	};
}

export default mock;
