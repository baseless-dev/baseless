import {
	assert,
	assertEquals,
	assertRejects,
	assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { App, initializeApp } from "./app.ts";
import {
	addChallenge,
	addIdentification,
	assertAuthApp,
	assertPersistence,
	AuthApp,
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
import { assertAuthenticationCeremonyResponseState } from "../common/auth/ceremony/response/state.ts";
import { assertAuthenticationCeremonyResponseEncryptedState } from "../common/auth/ceremony/response/encrypted_state.ts";
import { Message } from "../common/message/message.ts";
import { setGlobalLogHandler } from "../common/system/logger.ts";
import { generateKey } from "../common/system/otp.ts";
import { assertSendIdentificationChallengeResponse } from "../common/auth/send_identification_challenge_response.ts";
import { assertAuthenticationCeremonyResponseTokens } from "../common/auth/ceremony/response/tokens.ts";
import { decode } from "../common/encoding/base64.ts";
import type { Identity } from "../common/identity/identity.ts";
import { autoid } from "../common/system/autoid.ts";
import makeDummyServer, {
	type DummyServerResult,
} from "../server/make_dummy_server.ts";

Deno.test("Client Auth", async (t) => {
	const initializeDummyServerApp = async (): Promise<
		{
			identity: Identity;
			app: App;
			signIn: (authApp: AuthApp) => Promise<void>;
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
					totp,
					createIdentity,
					createIdentification,
					createChallenge,
				},
			) => {
				config.auth()
					.setEnabled(true)
					.setAllowAnonymousIdentity(true)
					.setCeremony(oneOf(sequence(email, password), sequence(email, totp)))
					.setExpirations({ accessToken: 200, refreshToken: 800 });
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
						{ challenge: "123" } as any,
					),
					confirmed: true,
				});
				await createChallenge({
					identityId: john.id,
					type: "totp",
					meta: await totp.configureIdentityChallenge(
						{ challenge: await generateKey(16) } as any,
					),
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
			signIn: async (authApp) => {
				const result = await submitAuthenticationIdentification(
					authApp,
					"email",
					"john@test.local",
				);
				assertAuthenticationCeremonyResponseEncryptedState(result);
				await submitAuthenticationChallenge(
					authApp,
					"password",
					"123",
					result.encryptedState,
				);
			},
		};
	};

	await t.step("initializeAuth", async () => {
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		assertAuthApp(authApp);
	});

	await t.step("getPersistence", async () => {
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		const persistence = getPersistence(authApp);
		assertPersistence(persistence);
	});

	await t.step("setPersistence", async () => {
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		// deno-lint-ignore no-explicit-any
		assertThrows(() => setPersistence(authApp, "invalid" as any));
		setPersistence(authApp, "local");
		assertEquals(getPersistence(authApp), "local");
		setPersistence(authApp, "session");
		assertEquals(getPersistence(authApp), "session");
	});

	await t.step("getAuthenticationCeremony", async () => {
		const { app, email } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		const { app, password, totp } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		await signOut(authApp);
	});

	await t.step("signOut", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		await signIn(authApp);
		await signOut(authApp);
		await assertRejects(() => signOut(authApp));
	});

	await t.step("sendChallengeValidationCode", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		await signIn(authApp);
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
		await signOut(authApp);
	});

	await t.step("confirmChallengeValidationCode", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		await signIn(authApp);
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
		await signOut(authApp);
	});

	await t.step("sendIdentificationChallenge", async () => {
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		await signOut(authApp);
	});

	await t.step("onAuthStateChange", async () => {
		const { app, identity: john, signIn } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		const changes: (Identity | undefined)[] = [];
		const unsubscribe = onAuthStateChange(authApp, (identity) => {
			changes.push(identity);
		});
		await signIn(authApp);
		assertEquals(changes, [john]);
		await signOut(authApp);
		assertEquals(changes, [john, undefined]);
		await signIn(authApp);
		assertEquals(changes, [john, undefined, john]);
		await new Promise((r) => setTimeout(r, 1000));
		assertEquals(changes, [john, undefined, john, undefined]);
		unsubscribe();
	});

	await t.step("getIdToken", async () => {
		const { app, signIn } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		await signIn(authApp);
		const idToken = await getIdToken(authApp);
		assert(idToken?.length ?? 0 > 0);
		await signOut(authApp);
	});

	await t.step("getIdentity", async () => {
		const { app, identity: john, signIn } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		await signIn(authApp);
		const identity = await getIdentity(authApp);
		assertEquals(identity, john);
		await signOut(authApp);
	});

	await t.step("createAnonymousIdentity", async () => {
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		const result1 = await createAnonymousIdentity(authApp);
		assertAuthenticationCeremonyResponseTokens(result1);
		await signOut(authApp);
	});

	await t.step("createIdentity", async () => {
		const { app, identityProvider } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		const { app, identityProvider } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
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
		await signOut(authApp);
	});

	await t.step("addIdentification", async () => {
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		await createAnonymousIdentity(authApp);
		await createIdentity(
			authApp,
			"email",
			"bob@test.local",
			"en",
		);
		await addIdentification(authApp, "email", "nobody@test.local", "en");
		await assertRejects(() =>
			addIdentification(authApp, "email", "john@test.local", "en")
		);
		await signOut(authApp);
	});

	await t.step("addChallenge", async () => {
		const { app } = await initializeDummyServerApp();
		const authApp = initializeAuth(app);
		await createAnonymousIdentity(authApp);
		await createIdentity(
			authApp,
			"email",
			"bob@test.local",
			"en",
		);
		await addChallenge(authApp, "password", "blep", "en");
		await assertRejects(() => addChallenge(authApp, "password", "blep", "en"));
		await signOut(authApp);
	});
});
