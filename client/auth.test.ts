import {
	assert,
	assertEquals,
	assertRejects,
	assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { assertApp, initializeApp } from "./app.ts";
import {
	assertPersistence,
	confirmIdentificationValidationCode,
	getAuthenticationCeremony,
	getPersistence,
	initializeAuth,
	onAuthStateChange,
	sendIdentificationValidationCode,
	setPersistence,
	submitAuthenticationChallenge,
	submitAuthenticationIdentification,
} from "./auth.ts";
import { config } from "../server/config.ts";
import { LocalAssetProvider } from "../providers/asset-local/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { KVIdentityProvider } from "../providers/identity-kv/mod.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";
import { LoggerMessageProvider } from "../providers/message-logger/mod.ts";
import { IdentityService } from "../server/services/identity.ts";
import { Server } from "../server/server.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { EmailAuthentificationIdenticator } from "../providers/auth-email/mod.ts";
import { PasswordAuthentificationChallenger } from "../providers/auth-password/mod.ts";
import {
	email,
	oneOf,
	otp,
	password,
	sequence,
} from "../common/auth/ceremony/component/helpers.ts";
import { assertAuthenticationCeremonyResponseState } from "../common/auth/ceremony/response/state.ts";
import { assertAuthenticationCeremonyResponseEncryptedState } from "../common/auth/ceremony/response/encrypted_state.ts";
import { assertAuthenticationCeremonyResponseDone } from "../common/auth/ceremony/response/done.ts";
import { Message } from "../common/message/message.ts";
import { setGlobalLogHandler } from "../common/system/logger.ts";

Deno.test("Client Auth", async (t) => {
	const mail = email({
		icon: "",
		label: { en: "Sign in with Email" },
	});
	const pass = password({ icon: "", label: { en: "Sign in with Password" } });
	const code = otp({
		type: "otp",
		icon: "",
		label: { en: "Sign in with Code" },
	});
	const { publicKey, privateKey } = await generateKeyPair("PS512");
	config.auth()
		.setEnabled(true)
		.setCeremony(oneOf(
			sequence(mail, pass),
			sequence(mail, code),
		))
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar")
		.addIdentificator(
			"email",
			new EmailAuthentificationIdenticator(new LoggerMessageProvider()),
		)
		.addChallenger("password", new PasswordAuthentificationChallenger());

	const configuration = config.build();
	const assetProvider = new LocalAssetProvider(import.meta.resolve("./public"));
	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const identityKV = new MemoryKVProvider();
	const identityProvider = new KVIdentityProvider(identityKV);
	const sessionKV = new MemoryKVProvider();
	const sessionProvider = new KVSessionProvider(sessionKV);

	const identityService = new IdentityService(
		configuration,
		identityProvider,
		counterProvider,
	);
	const john = await identityService.create({});
	await identityService.createIdentification({
		identityId: john.id,
		type: "email",
		identification: "john@test.local",
		verified: true,
		meta: {},
	});
	await identityService.createChallenge(
		john.id,
		"password",
		"123",
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
		async fetch(input, init) {
			const request = new Request(input, init);
			const [response] = await server.handleRequest(request, "127.0.0.1");
			return response;
		},
	});

	await t.step("initializeAuth", () => {
		const auth = initializeAuth(app);
		assertApp(auth);
	});

	await t.step("getPersistence", () => {
		const persistence = getPersistence(app);
		assertPersistence(persistence);
	});

	await t.step("setPersistence", () => {
		// deno-lint-ignore no-explicit-any
		assertThrows(() => setPersistence(app, "invalid" as any));
		setPersistence(app, "local");
		assertEquals(getPersistence(app), "local");
		setPersistence(app, "session");
		assertEquals(getPersistence(app), "session");
	});

	await t.step("onAuthStateChange", () => {
		const stateChange = new Array<number>();
		const disposer = onAuthStateChange(app, () => {
			stateChange.push(1);
		});
		assertEquals(typeof disposer, "function");
		assertEquals(stateChange, []);
	});

	await t.step("getAuthenticationCeremony", async () => {
		const result = await getAuthenticationCeremony(app);
		assertAuthenticationCeremonyResponseState(result);
		assertEquals(result.first, true);
		assertEquals(result.last, false);
		assertEquals(result.component, mail);
		assertAuthenticationCeremonyResponseState(
			await getAuthenticationCeremony(app, "invalid"),
		);
	});

	await t.step("submitAuthenticationIdentification", async () => {
		const result = await submitAuthenticationIdentification(
			app,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result);
		assertEquals(result.first, false);
		assertEquals(result.last, false);
		assertEquals(result.component, oneOf(pass, code));
		await assertRejects(() =>
			submitAuthenticationIdentification(app, "email", "unknown@test.local")
		);
	});

	await t.step("submitAuthenticationChallenge", async () => {
		const result1 = await submitAuthenticationIdentification(
			app,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		const result2 = await submitAuthenticationChallenge(
			app,
			"password",
			"123",
			result1.encryptedState,
		);
		assertAuthenticationCeremonyResponseDone(result2);
	});

	await t.step("sendIdentificationValidationCode", async () => {
		const messages: { ns: string; lvl: string; message: Message }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "message-logger") {
				messages.push({ ns, lvl, message: JSON.parse(msg)! });
			}
		});
		const result = await sendIdentificationValidationCode(app, "email", "john@test.local");
		setGlobalLogHandler(() => { });
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
		const sendResult = await sendIdentificationValidationCode(app, "email", "john@test.local");
		setGlobalLogHandler(() => { });
		assertEquals(sendResult.sent, true);
		const validationCode = messages[0]?.message.text;
		const confirmResult = await confirmIdentificationValidationCode(app, "email", "john@test.local", validationCode);
		assertEquals(confirmResult.confirmed, true);
	});
});
