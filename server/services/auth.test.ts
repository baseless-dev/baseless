import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { KVIdentityProvider } from "../../providers/identity-kv/mod.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import { AuthenticationService } from "./auth.ts";
import { ConfigurationBuilder } from "../config.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { IdentityService } from "./identity.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { EmailAuthentificationIdenticator } from "../../providers/auth-email/mod.ts";
import { PasswordAuthentificationChallenger } from "../../providers/auth-password/mod.ts";
import * as h from "../../common/auth/ceremony/component/helpers.ts";
import { Message } from "../../common/message/message.ts";
import { setGlobalLogHandler } from "../../common/system/logger.ts";
import { autoid } from "../../common/system/autoid.ts";
import { generateKey } from "../../common/system/otp.ts";
import { Context } from "../../common/server/context.ts";
import { LocalAssetProvider } from "../../providers/asset-local/mod.ts";
import { KVSessionProvider } from "../../providers/session-kv/mod.ts";
import { AssetService } from "./asset.ts";
import { CounterService } from "./counter.ts";
import { SessionService } from "./session.ts";
import { KVService } from "./kv.ts";
import { TOTPLoggerAuthentificationChallenger } from "../../providers/auth-totp-logger/mod.ts";

Deno.test("AuthenticationService", async (t) => {
	const email = { kind: "email", prompt: "email" as const };
	const totp = { kind: "totp", prompt: "otp" as const };
	const password = { kind: "password", prompt: "password" as const };
	const github = { kind: "github", prompt: "action" as const };

	const config = new ConfigurationBuilder();
	const { publicKey, privateKey } = await generateKeyPair("PS512");
	config.auth()
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar")
		.setCeremony(
			h.oneOf(
				h.sequence(email, password),
				h.sequence(email, totp),
				github,
			),
		)
		.addIdentificator(
			"email",
			new EmailAuthentificationIdenticator(new LoggerMessageProvider()),
		)
		.addChallenger("password", new PasswordAuthentificationChallenger())
		.addChallenger(
			"totp",
			new TOTPLoggerAuthentificationChallenger({
				period: 60,
				algorithm: "SHA-256",
				digits: 6,
			}),
		);

	const configuration = config.build();
	const assetProvider = new LocalAssetProvider(import.meta.resolve("./public"));
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const identityKV = new MemoryKVProvider();
	const identityProvider = new KVIdentityProvider(identityKV);
	const sessionKV = new MemoryKVProvider();
	const sessionProvider = new KVSessionProvider(sessionKV);
	const authService = new AuthenticationService(
		configuration,
		identityProvider,
		counterProvider,
		kvProvider,
	);
	const identityService = new IdentityService(
		configuration,
		identityProvider,
		counterProvider,
	);
	const context: Context = {
		config: configuration,
		asset: new AssetService(assetProvider),
		auth: authService,
		counter: new CounterService(counterProvider),
		identity: identityService,
		session: new SessionService(configuration, sessionProvider),
		kv: new KVService(kvProvider),
		remoteAddress: "127.0.0.1",
		waitUntil() { }
	}

	const john = await identityService.create({});
	await identityService.createIdentification({
		identityId: john.id,
		type: "email",
		identification: "john@test.local",
		verified: true,
		meta: {},
	});

	await identityService.createChallenge(
		context,
		john.id,
		"password",
		"123",
	);
	await identityService.createChallenge(
		context,
		john.id,
		"totp",
		await generateKey(16),
	);



	await t.step("getAuthenticationCeremony", async () => {
		assertEquals(
			await authService.getAuthenticationCeremony(),
			{
				state: { choices: [] },
				done: false,
				component: h.oneOf(email, github),
				first: true,
				last: false,
			},
		);
		assertEquals(
			await authService.getAuthenticationCeremony({ choices: ["email"] }),
			{
				state: { choices: ["email"] },
				done: false,
				component: h.oneOf(password, totp),
				first: false,
				last: false,
			},
		);
		await assertRejects(
			() => authService.getAuthenticationCeremony({ choices: ["github"] }),
		);
		await assertRejects(
			() =>
				authService.getAuthenticationCeremony({
					choices: ["email", "password"],
				}),
		);
		const identityId = autoid();
		assertEquals(
			await authService.getAuthenticationCeremony({
				identity: identityId,
				choices: ["email", "password"],
			}),
			{
				identityId,
				done: true,
			},
		);
	});

	await t.step("submitIdentification", async () => {
		assertEquals(
			await authService.submitAuthenticationIdentification(
				context,
				{ choices: [] },
				"email",
				"john@test.local",
				"localhost",
			),
			{
				done: false,
				component: h.oneOf(password, totp),
				first: false,
				last: false,
				state: { choices: ["email"], identity: john.id },
			},
		);
		await assertRejects(() =>
			authService.submitAuthenticationIdentification(
				context,
				{ choices: [] },
				"email",
				"unknown@test.local",
				"localhost",
			)
		);
	});

	await t.step("submitChallenge", async () => {
		assertEquals(
			await authService.submitAuthenticationChallenge(
				context,
				{ choices: ["email"], identity: john.id },
				"password",
				"123",
				"localhost",
			),
			{ done: true, identityId: john.id },
		);
		await assertRejects(() =>
			authService.submitAuthenticationChallenge(
				context,
				{ choices: [], identity: john.id },
				"password",
				"123",
				"localhost",
			)
		);
		await assertRejects(() =>
			authService.submitAuthenticationChallenge(
				context,
				{ choices: ["email"], identity: john.id },
				"password",
				"abc",
				"localhost",
			)
		);
	});

	let verificationCode = "";
	await t.step("sendIdentificationValidationCode", async () => {
		const messages: { ns: string; lvl: string; message: Message }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			messages.push({ ns, lvl, message: JSON.parse(msg)! });
		});
		await authService.sendIdentificationValidationCode(context, john.id, "email", "en");
		verificationCode = messages.pop()?.message.text ?? "";
		assertEquals(verificationCode.length, 6);
		setGlobalLogHandler(() => { });
	});

	await t.step("confirmIdentificationValidationCode", async () => {
		await assertRejects(() =>
			authService.confirmIdentificationValidationCode(
				john.id,
				"email",
				"000000",
			)
		);
		await authService.confirmIdentificationValidationCode(
			john.id,
			"email",
			verificationCode,
		);
	});

	await t.step("sendIdentificationChallenge", async () => {
		const messages: { ns: string; lvl: string; message: string }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "auth-totp-logger") {
				messages.push({ ns, lvl, message: msg });
			}
		});
		await authService.sendIdentificationChallenge(context, john.id, "totp", "en");
		const challengeCode = messages.pop()?.message ?? "";
		assertEquals(challengeCode.length, 6);
		setGlobalLogHandler(() => { });
		assertEquals(
			await authService.submitAuthenticationChallenge(
				context,
				{ choices: ["email"], identity: john.id },
				"totp",
				challengeCode,
				"localhost",
			),
			{ done: true, identityId: john.id },
		);
	});
});
