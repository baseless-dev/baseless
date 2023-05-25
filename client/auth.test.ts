import {
	assert,
	assertEquals,
	assertRejects,
	assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { App, assertApp, initializeApp } from "./app.ts";
import {
	addChallenge,
	addIdentification,
	assertPersistence,
	confirmChallengeValidationCode,
	confirmIdentificationValidationCode,
	createAnonymousIdentity,
	createIdentity,
	getAuthenticationCeremony,
	getIdToken,
	getPersistence,
	initializeAuth,
	onAuthStateChange,
	sendChallengeValidationCode,
	sendIdentificationChallenge,
	sendIdentificationValidationCode,
	setPersistence,
	signOut,
	submitAuthenticationChallenge,
	submitAuthenticationIdentification,
} from "./auth.ts";
import { LocalAssetProvider } from "../providers/asset-local/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { KVIdentityProvider } from "../providers/identity-kv/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { LoggerMessageProvider } from "../providers/message-logger/mod.ts";
import { Server } from "../server/server.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { EmailAuthentificationIdenticator } from "../providers/auth-email/mod.ts";
import { PasswordAuthentificationChallenger } from "../providers/auth-password/mod.ts";
import { oneOf } from "../common/auth/ceremony/component/helpers.ts";
import { assertAuthenticationCeremonyResponseState } from "../common/auth/ceremony/response/state.ts";
import { assertAuthenticationCeremonyResponseEncryptedState } from "../common/auth/ceremony/response/encrypted_state.ts";
import { Message } from "../common/message/message.ts";
import { setGlobalLogHandler } from "../common/system/logger.ts";
import { TOTPLoggerAuthentificationChallenger } from "../providers/auth-totp-logger/mod.ts";
import { generateKey } from "../common/system/otp.ts";
import { assertSendIdentificationChallengeResponse } from "../common/auth/send_identification_challenge_response.ts";
import { Context } from "../server/context.ts";
import * as h from "../common/auth/ceremony/component/helpers.ts";
import { ConfigurationBuilder } from "../common/server/config/config.ts";
import { assertAuthenticationCeremonyResponseTokens } from "../common/auth/ceremony/response/tokens.ts";
import { decode } from "../common/encoding/base64.ts";

Deno.test("Client Auth", async (t) => {
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
	const assetProvider = new LocalAssetProvider(import.meta.resolve("./public"));
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const identityKV = new MemoryKVProvider();
	const identityProvider = new KVIdentityProvider(identityKV);
	const sessionKV = new MemoryKVProvider();
	const sessionProvider = new KVSessionProvider(sessionKV);
	const context = new Context(
		[],
		"127.0.0.1",
		undefined,
		configuration,
		assetProvider,
		counterProvider,
		kvProvider,
		identityProvider,
		sessionProvider,
	);

	const identityService = context.identity;

	const john = await identityService.create({});
	await identityService.createIdentification({
		identityId: john.id,
		type: "email",
		identification: "john@test.local",
		confirmed: true,
		meta: {},
	});
	await identityService.createChallenge(
		john.id,
		"password",
		"123",
	);
	const identityChallenge = await identityService.getChallenge(
		john.id,
		"password",
	);
	await identityService.updateChallenge({
		...identityChallenge,
		confirmed: true,
	});
	await identityService.createChallenge(
		john.id,
		"totp",
		await generateKey(16),
	);

	const server = new Server({
		configuration,
		assetProvider,
		counterProvider,
		identityProvider,
		sessionProvider,
		kvProvider,
	});
	const app = initializeApp({
		clientId: "test",
		apiEndpoint: "http://test.local/api",
		async fetch(input, init): Promise<Response> {
			const request = new Request(input, init);
			const [response] = await server.handleRequest(request, "127.0.0.1");
			return response;
		},
	});
	let authApp: App;

	await t.step("initializeAuth", () => {
		authApp = initializeAuth(app);
		assertApp(authApp);
	});

	await t.step("getPersistence", () => {
		const persistence = getPersistence(authApp);
		assertPersistence(persistence);
	});

	await t.step("setPersistence", () => {
		// deno-lint-ignore no-explicit-any
		assertThrows(() => setPersistence(authApp, "invalid" as any));
		setPersistence(authApp, "local");
		assertEquals(getPersistence(authApp), "local");
		setPersistence(authApp, "session");
		assertEquals(getPersistence(authApp), "session");
	});

	await t.step("onAuthStateChange", () => {
		const stateChange = new Array<number>();
		const disposer = onAuthStateChange(authApp, () => {
			stateChange.push(1);
		});
		assertEquals(typeof disposer, "function");
		assertEquals(stateChange, []);
	});

	await t.step("getAuthenticationCeremony", async () => {
		const result = await getAuthenticationCeremony(authApp);
		assertAuthenticationCeremonyResponseState(result);
		assertEquals(result.first, true);
		assertEquals(result.last, false);
		// deno-lint-ignore no-explicit-any
		assertEquals(result.component, email.toJSON() as any);
		assertAuthenticationCeremonyResponseState(
			await getAuthenticationCeremony(authApp, "invalid"),
		);
	});

	await t.step("sendIdentificationValidationCode", async () => {
		const messages: { ns: string; lvl: string; message: Message }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "message-logger") {
				messages.push({ ns, lvl, message: JSON.parse(msg)! });
			}
		});
		const result = await sendIdentificationValidationCode(
			authApp,
			"email",
			"john@test.local",
		);
		setGlobalLogHandler(() => {});
		assertEquals(result.sent, true);
		assertEquals(messages[0]?.message.text.length, 6);
	});

	await t.step("confirmIdentificationValidationCode", async () => {
		const messages: { ns: string; lvl: string; message: Message }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "message-logger") {
				messages.push({ ns, lvl, message: JSON.parse(msg)! });
			}
		});
		const sendResult = await sendIdentificationValidationCode(
			authApp,
			"email",
			"john@test.local",
		);
		setGlobalLogHandler(() => {});
		assertEquals(sendResult.sent, true);
		const validationCode = messages[0]?.message.text;
		const confirmResult = await confirmIdentificationValidationCode(
			authApp,
			"email",
			"john@test.local",
			validationCode,
		);
		assertEquals(confirmResult.confirmed, true);
	});

	await t.step("submitAuthenticationIdentification", async () => {
		const result = await submitAuthenticationIdentification(
			authApp,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result);
		assertEquals(result.first, false);
		assertEquals(result.last, false);
		assertEquals(
			result.component,
			// deno-lint-ignore no-explicit-any
			oneOf(password.toJSON() as any, totp.toJSON() as any),
		);
		await assertRejects(() =>
			submitAuthenticationIdentification(authApp, "email", "unknown@test.local")
		);
	});

	await t.step("submitAuthenticationChallenge", async () => {
		const result1 = await submitAuthenticationIdentification(
			authApp,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		const result2 = await submitAuthenticationChallenge(
			authApp,
			"password",
			"123",
			result1.encryptedState,
		);
		assertAuthenticationCeremonyResponseTokens(result2);
	});

	await t.step("sendChallengeValidationCode", async () => {
		await signOut(authApp).catch((_) => {});
		const result1 = await submitAuthenticationIdentification(
			authApp,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		await submitAuthenticationChallenge(
			authApp,
			"password",
			"123",
			result1.encryptedState,
		);
		const messages: { ns: string; lvl: string; message: string }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "auth-totp-logger") {
				messages.push({ ns, lvl, message: msg });
			}
		});
		const result = await sendChallengeValidationCode(
			authApp,
			"totp",
		);
		setGlobalLogHandler(() => {});
		assertEquals(result.sent, true);
		assertEquals(messages[0]?.message.length, 6);
	});

	await t.step("confirmChallengeValidationCode", async () => {
		await signOut(authApp).catch((_) => {});
		const result1 = await submitAuthenticationIdentification(
			authApp,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		await submitAuthenticationChallenge(
			authApp,
			"password",
			"123",
			result1.encryptedState,
		);
		const messages: { ns: string; lvl: string; message: string }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "auth-totp-logger") {
				messages.push({ ns, lvl, message: msg });
			}
		});
		const result = await sendChallengeValidationCode(
			authApp,
			"totp",
		);
		setGlobalLogHandler(() => {});
		assertEquals(result.sent, true);
		const validationCode = messages[0]?.message;
		const confirmResult = await confirmChallengeValidationCode(
			authApp,
			"totp",
			validationCode,
		);
		assertEquals(confirmResult.confirmed, true);
	});

	await t.step("sendIdentificationChallenge", async () => {
		const result1 = await submitAuthenticationIdentification(
			authApp,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		const messages: { ns: string; lvl: string; message: string }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "auth-totp-logger") {
				messages.push({ ns, lvl, message: msg! });
			}
		});
		const result2 = await sendIdentificationChallenge(
			authApp,
			"totp",
			result1.encryptedState,
		);
		assertSendIdentificationChallengeResponse(result2);
		const challengeCode = messages.pop()?.message ?? "";
		assertEquals(challengeCode.length, 6);
		setGlobalLogHandler(() => {});
		const result3 = await submitAuthenticationChallenge(
			authApp,
			"totp",
			challengeCode,
			result1.encryptedState,
		);
		assertAuthenticationCeremonyResponseTokens(result3);
	});

	await t.step("signOut", async () => {
		await signOut(authApp);
		await assertRejects(() => signOut(authApp));
	});

	await t.step("onAuthStateChange", async () => {
		const changes: number[] = [];
		onAuthStateChange(authApp, () => {
			changes.push(1);
		});
		const result1 = await submitAuthenticationIdentification(
			authApp,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		const result2 = await submitAuthenticationChallenge(
			authApp,
			"password",
			"123",
			result1.encryptedState,
		);
		assertAuthenticationCeremonyResponseTokens(result2);
		assertEquals(changes, [1]);
		await signOut(authApp);
		assertEquals(changes, [1, 1]);
	});

	await t.step("getIdToken", async () => {
		const result1 = await submitAuthenticationIdentification(
			authApp,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		const result2 = await submitAuthenticationChallenge(
			authApp,
			"password",
			"123",
			result1.encryptedState,
		);
		assertAuthenticationCeremonyResponseTokens(result2);
		const idToken = await getIdToken(authApp);
		assert(idToken?.length ?? 0 > 0);
	});

	await t.step("createAnonymousIdentity", async () => {
		await signOut(authApp);
		const result1 = await createAnonymousIdentity(authApp);
		assertAuthenticationCeremonyResponseTokens(result1);
	});

	await t.step("createIdentity", async () => {
		await signOut(authApp);
		await createIdentity(
			authApp,
			"email",
			"jane@test.local",
			"en",
		);
		const identity1 = await identityProvider.matchIdentification(
			"email",
			"jane@test.local",
		);
		assertEquals(identity1.confirmed, false);
	});

	await t.step("createIdentity claims anonymous identity", async () => {
		await signOut(authApp).catch((_) => {});
		const result1 = await createAnonymousIdentity(authApp);
		assertAuthenticationCeremonyResponseTokens(result1);
		const idTokenPayload = decode(result1.id_token.split(".")[1]);
		const idToken = JSON.parse(new TextDecoder().decode(idTokenPayload));
		const anonymousIdentityId = `${idToken.sub}`;
		await createIdentity(
			authApp,
			"email",
			"bob@test.local",
			"en",
		);
		const identity1 = await identityProvider.matchIdentification(
			"email",
			"bob@test.local",
		);
		assertEquals(identity1.identityId, anonymousIdentityId);
		await assertRejects(() =>
			createIdentity(
				authApp,
				"email",
				"foo@test.local",
				"en",
			)
		);
	});

	await t.step("addIdentification", async () => {
		await addIdentification(authApp, "email", "nobody@test.local", "en");
		await assertRejects(() =>
			addIdentification(authApp, "email", "john@test.local", "en")
		);
	});

	await t.step("addChallenge", async () => {
		await addChallenge(authApp, "password", "blep", "en");
		await assertRejects(() => addChallenge(authApp, "password", "blep", "en"));
	});
});
