import {
	assert,
	assertEquals,
	assertNotEquals,
	assertRejects,
	assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { App, initializeApp } from "./app.ts";
import {
	addChallenge,
	addIdentification,
	assertInitializedAuth,
	assertPersistence,
	confirmChallengeValidationCode,
	confirmIdentificationValidationCode,
	createAnonymousIdentity,
	createIdentity,
	getAuthenticationCeremony,
	getIdentity,
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
import { oneOf } from "../common/auth/ceremony/component/helpers.ts";
import { assertAuthenticationCeremonyResponseState } from "../common/auth/ceremony/response.ts";
import { assertAuthenticationCeremonyResponseEncryptedState } from "../common/auth/ceremony/response.ts";
import { Message } from "../common/message/message.ts";
import { setGlobalLogHandler } from "../common/system/logger.ts";
import { assertSendIdentificationChallengeResponse } from "../common/auth/send_identification_challenge_response.ts";
import { assertAuthenticationCeremonyResponseTokens } from "../common/auth/ceremony/response.ts";
import { decode } from "../common/encoding/base64.ts";
import type { Identity } from "../common/identity/identity.ts";
import { autoid } from "../common/system/autoid.ts";
import makeDummyServer, {
	type DummyServerResult,
} from "../server/make_dummy_server.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.test("Client Auth", async (t) => {
	const initializeDummyServerApp = async (): Promise<
		{
			identity: Identity;
			app: App;
			signIn: (app: App) => Promise<void>;
		} & DummyServerResult
	> => {
		let john: Identity;
		const result = await makeDummyServer(
			async (
				{
					config,
					oneOf,
					sequence,
					email,
					password,
					otp,
					createIdentity,
					createIdentification,
					createChallenge,
				},
			) => {
				config.auth()
					.setEnabled(true)
					.setAllowAnonymousIdentity(true)
					.setCeremony(oneOf(sequence(email, password), sequence(email, otp)))
					.setExpirations({ accessToken: 1_000, refreshToken: 4_000 });
				john = await createIdentity({});
				await createIdentification({
					identityId: john.id,
					type: "email",
					identification: "john@test.local",
					confirmed: true,
					meta: {},
				});
				await createChallenge({
					identityId: john.id,
					type: "password",
					meta: await password.configureIdentityChallenge(
						// deno-lint-ignore no-explicit-any
						{ challenge: "123" } as any,
					),
					confirmed: true,
				});
				await createChallenge({
					identityId: john.id,
					type: "otp",
					meta: {},
					confirmed: true,
				});
			},
		);

		const app = initializeApp({
			clientId: autoid(),
			apiEndpoint: "http://test.local/api",
			async fetch(input, init): Promise<Response> {
				const request = new Request(input, init);
				const [response] = await result.server.handleRequest(
					request,
					"127.0.0.1",
				);
				return response;
			},
		});

		return {
			...result,
			identity: john!,
			app,
			signIn: async (app) => {
				const result = await submitAuthenticationIdentification(
					app,
					"email",
					"john@test.local",
				);
				assertAuthenticationCeremonyResponseEncryptedState(result);
				await submitAuthenticationChallenge(
					app,
					"password",
					"123",
					result.encryptedState,
				);
			},
		};
	};

	await t.step("initializeAuth", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		assertInitializedAuth(app);
	});

	await t.step("getPersistence", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		const persistence = getPersistence(app);
		assertPersistence(persistence);
	});

	await t.step("setPersistence", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		// deno-lint-ignore no-explicit-any
		assertThrows(() => setPersistence(app, "invalid" as any));
		setPersistence(app, "local");
		assertEquals(getPersistence(app), "local");
		setPersistence(app, "session");
		assertEquals(getPersistence(app), "session");
	});

	await t.step("getAuthenticationCeremony", async () => {
		const { app, email } = await initializeDummyServerApp();
		initializeAuth(app);
		const result = await getAuthenticationCeremony(app);
		assertAuthenticationCeremonyResponseState(result);
		assertEquals(result.first, true);
		assertEquals(result.last, false);
		assertEquals(result.component, JSON.parse(JSON.stringify(email)));
		assertAuthenticationCeremonyResponseState(
			await getAuthenticationCeremony(app, "invalid"),
		);
	});

	await t.step("sendIdentificationValidationCode", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		const messages: { ns: string; lvl: string; message: Message }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "message-logger") {
				messages.push({ ns, lvl, message: JSON.parse(msg)! });
			}
		});
		const result = await sendIdentificationValidationCode(
			app,
			"email",
			"john@test.local",
		);
		setGlobalLogHandler(() => {});
		assertEquals(result.sent, true);
		assertEquals(messages[0]?.message.text.length, 6);
	});

	await t.step("confirmIdentificationValidationCode", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		const messages: { ns: string; lvl: string; message: Message }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "message-logger") {
				messages.push({ ns, lvl, message: JSON.parse(msg)! });
			}
		});
		const sendResult = await sendIdentificationValidationCode(
			app,
			"email",
			"john@test.local",
		);
		setGlobalLogHandler(() => {});
		assertEquals(sendResult.sent, true);
		const validationCode = messages[0]?.message.text;
		const confirmResult = await confirmIdentificationValidationCode(
			app,
			"email",
			"john@test.local",
			validationCode,
		);
		assertEquals(confirmResult.confirmed, true);
	});

	await t.step("submitAuthenticationIdentification", async () => {
		const { app, password, otp } = await initializeDummyServerApp();
		initializeAuth(app);
		const result = await submitAuthenticationIdentification(
			app,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result);
		assertEquals(result.first, false);
		assertEquals(result.last, false);
		assertEquals(
			result.component,
			JSON.parse(JSON.stringify(oneOf(password, otp))),
		);
		await assertRejects(() =>
			submitAuthenticationIdentification(app, "email", "unknown@test.local")
		);
	});

	await t.step("submitAuthenticationChallenge", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
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
		assertAuthenticationCeremonyResponseTokens(result2);
		await signOut(app);
	});

	await t.step("signOut", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		initializeAuth(app);
		await signIn(app);
		await signOut(app);
		await assertRejects(() => signOut(app));
	});

	await t.step("sendChallengeValidationCode", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		initializeAuth(app);
		await signIn(app);
		const messages: { ns: string; lvl: string; message: string }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "auth-otp-logger") {
				messages.push({ ns, lvl, message: msg });
			}
		});
		const result = await sendChallengeValidationCode(
			app,
			"otp",
		);
		setGlobalLogHandler(() => {});
		assertEquals(result.sent, true);
		assertEquals(messages[0]?.message.length, 6);
		await signOut(app);
	});

	await t.step("confirmChallengeValidationCode", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		initializeAuth(app);
		await signIn(app);
		const messages: { ns: string; lvl: string; message: string }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "auth-otp-logger") {
				messages.push({ ns, lvl, message: msg });
			}
		});
		const result = await sendChallengeValidationCode(
			app,
			"otp",
		);
		setGlobalLogHandler(() => {});
		assertEquals(result.sent, true);
		const validationCode = messages[0]?.message;
		const confirmResult = await confirmChallengeValidationCode(
			app,
			"otp",
			validationCode,
		);
		assertEquals(confirmResult.confirmed, true);
		await signOut(app);
	});

	await t.step("sendIdentificationChallenge", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		const result1 = await submitAuthenticationIdentification(
			app,
			"email",
			"john@test.local",
		);
		assertAuthenticationCeremonyResponseEncryptedState(result1);
		const messages: { ns: string; lvl: string; message: string }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			if (ns === "auth-otp-logger") {
				messages.push({ ns, lvl, message: msg! });
			}
		});
		const result2 = await sendIdentificationChallenge(
			app,
			"otp",
			result1.encryptedState,
		);
		assertSendIdentificationChallengeResponse(result2);
		const challengeCode = messages.pop()?.message ?? "";
		assertEquals(challengeCode.length, 6);
		setGlobalLogHandler(() => {});
		const result3 = await submitAuthenticationChallenge(
			app,
			"otp",
			challengeCode,
			result1.encryptedState,
		);
		assertAuthenticationCeremonyResponseTokens(result3);
		await signOut(app);
	});

	await t.step("onAuthStateChange", async () => {
		const { app, identity: john, signIn } = await initializeDummyServerApp();
		initializeAuth(app);
		const changes: (Identity | undefined)[] = [];
		const unsubscribe = onAuthStateChange(app, (identity) => {
			changes.push(identity);
		});
		await signIn(app);
		assertEquals(changes, [john]);
		await signOut(app);
		assertEquals(changes, [john, undefined]);
		await signIn(app);
		assertEquals(changes, [john, undefined, john]);
		await sleep(4200);
		assertEquals(changes, [john, undefined, john, undefined]);
		unsubscribe();
	});

	await t.step("getIdToken", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		initializeAuth(app);
		await signIn(app);
		const idToken = await getIdToken(app);
		assert(idToken?.length ?? 0 > 0);
		await signOut(app);
	});

	await t.step("getIdentity", async () => {
		const { app, identity: john, signIn } = await initializeDummyServerApp();
		initializeAuth(app);
		await signIn(app);
		const identity = await getIdentity(app);
		assertEquals(identity, john);
		await signOut(app);
	});

	await t.step("createAnonymousIdentity", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		const result1 = await createAnonymousIdentity(app);
		assertAuthenticationCeremonyResponseTokens(result1);
		await signOut(app);
	});

	await t.step("createIdentity", async () => {
		const { app, identityProvider } = await initializeDummyServerApp();
		initializeAuth(app);
		await createIdentity(
			app,
			[{ id: "email", value: "jane@test.local" }],
			[],
			"en",
		);
		const identity1 = await identityProvider.matchIdentification(
			"email",
			"jane@test.local",
		);
		assertEquals(identity1.confirmed, false);
		await signOut(app);
	});

	await t.step("createIdentity claims anonymous identity", async () => {
		const { app, identityProvider } = await initializeDummyServerApp();
		initializeAuth(app);
		const result1 = await createAnonymousIdentity(app);
		assertAuthenticationCeremonyResponseTokens(result1);
		const idTokenPayload = decode(result1.id_token.split(".")[1]);
		const idToken = JSON.parse(new TextDecoder().decode(idTokenPayload));
		const anonymousIdentityId = `${idToken.sub}`;
		await createIdentity(
			app,
			[{ id: "email", value: "bob@test.local" }],
			[],
			"en",
		);
		const identity1 = await identityProvider.matchIdentification(
			"email",
			"bob@test.local",
		);
		assertEquals(identity1.identityId, anonymousIdentityId);
		await assertRejects(() =>
			createIdentity(
				app,
				[{ id: "email", value: "foo@test.local" }],
				[],
				"en",
			)
		);
		await signOut(app);
	});

	await t.step("addIdentification", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		await createAnonymousIdentity(app);
		await createIdentity(
			app,
			[{ id: "email", value: "bob@test.local" }],
			[],
			"en",
		);
		await addIdentification(app, "email", "nobody@test.local", "en");
		await assertRejects(() =>
			addIdentification(app, "email", "john@test.local", "en")
		);
		await signOut(app);
	});

	await t.step("addChallenge", async () => {
		const { app } = await initializeDummyServerApp();
		initializeAuth(app);
		await createAnonymousIdentity(app);
		await createIdentity(
			app,
			[{ id: "email", value: "bob@test.local" }],
			[],
			"en",
		);
		await addChallenge(app, "password", "blep", "en");
		await assertRejects(() => addChallenge(app, "password", "blep", "en"));
		await signOut(app);
	});

	await t.step("refreshToken when needed", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		initializeAuth(app);
		await signIn(app);
		const idToken1 = await getIdToken(app);
		assert(idToken1);
		await sleep(1200);
		await getAuthenticationCeremony(app);
		const idToken2 = await getIdToken(app);
		assert(idToken2);
		assertNotEquals(idToken1, idToken2);
		await signOut(app);
	});
});
