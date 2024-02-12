import { generateKeyPair } from "../deps.ts";
import { MemoryAssetProvider } from "../providers/asset-memory/mod.ts";
import PasswordAuthentificationComponent from "../providers/auth-password/mod.ts";
import EmailAuthentificationComponent from "../providers/auth-email/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { MemoryDocumentProvider } from "../providers/document-memory/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { DocumentIdentityProvider } from "../providers/identity-document/mod.ts";
import authenticationPlugin from "../plugins/authentication/mod.ts";
import registrationPlugin from "../plugins/registration/mod.ts";
import assetPlugin from "../plugins/asset/mod.ts";
import OTPMessageAuthentificationComponent from "../providers/auth-otp-message/mod.ts";
import TOTPAuthentificationComponent from "../providers/auth-totp/mod.ts";
import type { AuthenticationOptions } from "../plugins/authentication/mod.ts";
import { oneOf, sequence } from "../lib/authentication/types.ts";
import { Router } from "../lib/router/router.ts";
import { MemoryMessageProvider } from "../providers/message-memory/mod.ts";
import type { Context as AuthenticationContext } from "../plugins/authentication/context.ts";
import type { Context as RegistrationContext } from "../plugins/registration/context.ts";
import type { Context as AssetContext } from "../plugins/asset/context.ts";

export { t } from "../deps.ts";

export type MockResult = {
	router: Router<AuthenticationContext & RegistrationContext & AssetContext>;
	providers: {
		kv: MemoryKVProvider;
		document: MemoryDocumentProvider;
		asset: MemoryAssetProvider;
		identity: DocumentIdentityProvider;
		session: KVSessionProvider;
		message: MemoryMessageProvider;
	};
	components: {
		email: EmailAuthentificationComponent;
		password: PasswordAuthentificationComponent;
		otp: OTPMessageAuthentificationComponent;
		totp: TOTPAuthentificationComponent;
		oneOf: typeof oneOf;
		sequence: typeof sequence;
	};
};

export type BuilderResult = {
	auth?: Partial<
		Omit<
			AuthenticationOptions,
			"counter" | "kv" | "identity" | "session"
		>
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
	const message = new MemoryMessageProvider();
	const email = new EmailAuthentificationComponent(
		"email",
		identity,
		kv,
		message,
	);
	const password = new PasswordAuthentificationComponent(
		"password",
		"lesalt",
	);
	const otp = new OTPMessageAuthentificationComponent("otp", kv, message, {
		digits: 6,
	});
	const totp = new TOTPAuthentificationComponent("totp", {
		digits: 6,
		period: 60,
	});
	let router = new Router();
	const result = {
		router,
		providers: {
			kv,
			document,
			asset,
			identity,
			session,
			message,
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
	const keys = auth?.keys ??
		{ ...await generateKeyPair("PS512"), algo: "PS512" };
	router = router
		.use(
			"/api/authentication",
			authenticationPlugin({
				counter,
				identity,
				session,
				kv,
				keys,
				salt: "should probably be a secret more robust than this",
				ceremony: sequence(
					email,
					password,
				),
				...auth,
			}),
		)
		.use(
			"/api/registration",
			registrationPlugin({
				counter,
				identity,
				keys,
				ceremony: sequence(
					email,
					password,
				),
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
