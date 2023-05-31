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

export default async function MemoryServer(): Promise<Server>;
export default async function MemoryServer(emailIdentification: string, passChallenge: string): Promise<Server>;
export default async function MemoryServer(emailIdentification?: string, passChallenge?: string): Promise<Server> {
	const email = new EmailAuthentificationIdenticator(
		new LoggerMessageProvider(),
	);
	const password = new PasswordAuthentificationChallenger();
	const totp = new TOTPLoggerAuthentificationChallenger({
		period: 60,
		algorithm: "SHA-256",
		digits: 6,
	});

	const config = new ConfigurationBuilder();
	const { publicKey, privateKey } = await generateKeyPair("PS512");
	config.auth()
		.setEnabled(true)
		.setAllowAnonymousIdentity(true)
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar")
		.setCeremony(
			h.oneOf(
				h.sequence(email, password),
				h.sequence(email, totp),
			),
		);

	const configuration = config.build();
	const assetProvider = new MemoryAssetProvider();
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const identityKV = new MemoryKVProvider();
	const identityProvider = new KVIdentityProvider(identityKV);
	const sessionKV = new MemoryKVProvider();
	const sessionProvider = new KVSessionProvider(sessionKV);

	if (emailIdentification && passChallenge) {
		const ident = await identityProvider.create({});
		await identityProvider.createIdentification({
			identityId: ident.id,
			type: "email",
			identification: emailIdentification,
			confirmed: true,
			meta: {},
		});
		await identityProvider.createChallenge({
			identityId: ident.id,
			type: "password",
			confirmed: true,
			meta: await password.configureIdentityChallenge({ challenge: passChallenge } as any)
		});
	}

	return new Server({
		configuration,
		assetProvider,
		counterProvider,
		identityProvider,
		sessionProvider,
		kvProvider,
	});
}