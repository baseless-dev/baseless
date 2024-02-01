import {
	assert,
	assertEquals,
	assertNotEquals,
	assertRejects,
	assertThrows,
} from "../deps.test.ts";
import { Assert, generateKeyPair } from "../deps.ts";
import { assertAutoId, autoid } from "../lib/autoid.ts";
import type { ID } from "../lib/identity/types.ts";
import { setGlobalLogHandler } from "../lib/logger.ts";
import mock, { MockResult } from "../server/mock.ts";
import { type App, initializeApp } from "./app.ts";
import {
	assertInitializedAuth,
	assertPersistence,
	getCeremony,
	getIdentity,
	getIdToken,
	getPersistence,
	initializeAuth,
	onAuthStateChange,
	sendSignInPrompt,
	setPersistence,
	signOut,
	submitSignInPrompt,
	submitSignUpPrompt,
} from "./auth.ts";
import type { Message } from "../lib/message/types.ts";
import {
	AuthenticationCeremonyResponseNextSchema,
	AuthenticationCeremonyResponseStartSchema,
	AuthenticationSignInResponseDoneSchema,
} from "../lib/auth/types.ts";

Deno.test("Client Auth", async (t) => {
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	let cachedKeys: Awaited<ReturnType<typeof generateKeyPair>> | undefined;
	const initMockServer = async (): Promise<
		{
			identity: ID;
			app: App;
			signIn: (app: App) => Promise<void>;
		} & MockResult
	> => {
		let john: ID;
		const result = await mock(async (r) => {
			if (!cachedKeys) {
				cachedKeys = await generateKeyPair("PS512");
			}
			john = await r.providers.identity.create(
				{},
				{
					email: {
						id: "email",
						identification: "john@test.local",
						confirmed: true,
						meta: {},
					},
					password: {
						id: "password",
						confirmed: true,
						...await r.components.password.getIdentityComponentMeta(
							{ value: "123" },
						),
					},
					otp: {
						id: "otp",
						confirmed: true,
						meta: {},
					},
				},
			);
			const { publicKey, privateKey } = cachedKeys;
			return {
				auth: {
					keys: { algo: "PS512", publicKey, privateKey },
					salt: "foobar",
					allowAnonymousIdentity: true,
					accessTokenTTL: 1_000,
					refreshTokenTTL: 4_000,
					ceremony: r.components.oneOf(
						r.components.sequence(
							r.components.email,
							r.components.password,
						),
						r.components.sequence(
							r.components.email,
							r.components.otp,
						),
					),
					components: [
						r.components.email,
						r.components.password,
						r.components.otp,
					],
				},
			};
		});

		const routeHandler = await result.router.build();

		const app = initializeApp({
			clientId: autoid(),
			apiEndpoint: "http://test.local/api",
			async fetch(input, init): Promise<Response> {
				const request = new Request(input, init);
				return await routeHandler(
					request,
				);
			},
		});

		return {
			...result,
			identity: john!,
			app,
			signIn: async (app) => {
				const result = await submitSignInPrompt(
					app,
					"email",
					"john@test.local",
				);
				Assert(AuthenticationCeremonyResponseNextSchema, result);
				await submitSignInPrompt(
					app,
					"password",
					"123",
					result.encryptedState,
				);
			},
		};
	};

	// await t.step("initializeAuth", async () => {
	// 	const { app } = await initMockServer();
	// 	initializeAuth(app);
	// 	assertInitializedAuth(app);
	// });

	// await t.step("getPersistence", async () => {
	// 	const { app } = await initMockServer();
	// 	initializeAuth(app);
	// 	const persistence = getPersistence(app);
	// 	assertPersistence(persistence);
	// });

	// await t.step("setPersistence", async () => {
	// 	const { app } = await initMockServer();
	// 	initializeAuth(app);
	// 	assertThrows(() => setPersistence(app, "invalid" as any));
	// 	setPersistence(app, "local");
	// 	assertEquals(getPersistence(app), "local");
	// 	setPersistence(app, "session");
	// 	assertEquals(getPersistence(app), "session");
	// });

	// await t.step("getCeremony", async () => {
	// 	const { app, components: { email } } = await initMockServer();
	// 	initializeAuth(app);
	// 	const result = await getCeremony(app);
	// 	Assert(AuthenticationCeremonyResponseStartSchema, result);
	// 	assertEquals(result.first, true);
	// 	assertEquals(result.last, false);
	// 	assertEquals(
	// 		result.component,
	// 		JSON.parse(JSON.stringify(email)),
	// 	);
	// 	await assertRejects(() => getCeremony(app, "invalid"));
	// });

	// await t.step("submitSignInPrompt", async () => {
	// 	const { app } = await initMockServer();
	// 	initializeAuth(app);
	// 	const result1 = await submitSignInPrompt(
	// 		app,
	// 		"email",
	// 		"john@test.local",
	// 	);
	// 	Assert(AuthenticationCeremonyResponseNextSchema, result1);
	// 	assertEquals(result1.first, false);
	// 	assertEquals(result1.last, false);
	// 	const result2 = await submitSignInPrompt(
	// 		app,
	// 		"password",
	// 		"123",
	// 		result1.encryptedState,
	// 	);
	// 	Assert(AuthenticationSignInResponseDoneSchema, result2);
	// 	await signOut(app);
	// });

	// await t.step("sendSignInPrompt", async () => {
	// 	const { app } = await initMockServer();
	// 	initializeAuth(app);
	// 	const result1 = await submitSignInPrompt(
	// 		app,
	// 		"email",
	// 		"john@test.local",
	// 	);
	// 	Assert(AuthenticationCeremonyResponseNextSchema, result1);
	// 	const messages: { ns: string; lvl: string; message: string }[] = [];
	// 	setGlobalLogHandler((ns, lvl, msg) => {
	// 		if (ns === "auth-otp-logger") {
	// 			messages.push({ ns, lvl, message: msg! });
	// 		}
	// 	});
	// 	await sendSignInPrompt(
	// 		app,
	// 		"otp",
	// 		result1.encryptedState,
	// 	);
	// 	const challengeCode = messages.pop()?.message ?? "";
	// 	assertEquals(challengeCode.length, 6);
	// 	setGlobalLogHandler(() => {});
	// 	const result3 = await submitSignInPrompt(
	// 		app,
	// 		"otp",
	// 		challengeCode,
	// 		result1.encryptedState,
	// 	);
	// 	Assert(AuthenticationSignInResponseDoneSchema, result3);
	// 	await signOut(app);
	// });

	// await t.step("signOut", async () => {
	// 	const { app, signIn } = await initMockServer();
	// 	initializeAuth(app);
	// 	await signIn(app);
	// 	await signOut(app);
	// 	await assertRejects(() => signOut(app));
	// });

	// await t.step("onAuthStateChange", async () => {
	// 	const { app, identity, signIn } = await initMockServer();
	// 	const john = { id: identity.id, meta: identity.meta };
	// 	initializeAuth(app);
	// 	const changes: (ID | undefined)[] = [];
	// 	const unsubscribe = onAuthStateChange(app, (identity) => {
	// 		changes.push(identity);
	// 	});
	// 	await signIn(app);
	// 	assertEquals(changes, [john]);
	// 	await signOut(app);
	// 	assertEquals(changes, [john, undefined]);
	// 	await signIn(app);
	// 	assertEquals(changes, [john, undefined, john]);
	// 	await sleep(4200);
	// 	assertEquals(changes, [john, undefined, john, undefined]);
	// 	unsubscribe();
	// });

	// await t.step("getIdToken", async () => {
	// 	const { app, signIn } = await initMockServer();
	// 	initializeAuth(app);
	// 	await signIn(app);
	// 	const idToken = await getIdToken(app);
	// 	assert(idToken?.length ?? 0 > 0);
	// 	await signOut(app);
	// });

	// await t.step("getIdentity", async () => {
	// 	const { app, identity, signIn } = await initMockServer();
	// 	const john = { id: identity.id, meta: identity.meta };
	// 	initializeAuth(app);
	// 	await signIn(app);
	// 	const id1 = await getIdentity(app);
	// 	assertEquals(id1, john);
	// 	await signOut(app);
	// });

	// await t.step("refresh token when needed", async () => {
	// 	const { app, signIn } = await initMockServer();
	// 	initializeAuth(app);
	// 	await signIn(app);
	// 	const idToken1 = await getIdToken(app);
	// 	assert(idToken1);
	// 	await sleep(2200);
	// 	await getCeremony(app);
	// 	const idToken2 = await getIdToken(app);
	// 	assert(idToken2);
	// 	assertNotEquals(idToken1, idToken2);
	// 	await signOut(app);
	// });

	await t.step("submitSignUpPrompt", async () => {
		const { app } = await initMockServer();
		initializeAuth(app);
		const result1 = await submitSignUpPrompt(
			app,
			"email",
			"jane@test.local",
		);
		Assert(AuthenticationCeremonyResponseNextSchema, result1);
		assertEquals(result1.first, false);
		assertEquals(result1.last, false);
		const result2 = await submitSignUpPrompt(
			app,
			"password",
			"123",
			result1.encryptedState,
		);
		Assert(AuthenticationSignInResponseDoneSchema, result2);
		await signOut(app);
	});

	// await t.step("sendSignInValidationCode", async () => {
	// 	const { app, signIn } = await initMockServer();
	// 	initializeAuth(app);
	// 	await signIn(app);
	// 	const messages: { ns: string; lvl: string; message: Message }[] = [];
	// 	setGlobalLogHandler((ns, lvl, msg) => {
	// 		if (ns === "message-logger") {
	// 			messages.push({ ns, lvl, message: JSON.parse(msg)! });
	// 		}
	// 	});
	// 	const result = await sendSignInValidationCode(
	// 		app,
	// 		"email",
	// 		undefined,
	// 	);
	// 	setGlobalLogHandler(() => {});
	// 	assertEquals(result.sent, true);
	// 	assertAutoId(messages[0]?.message.text, "code_");
	// 	await signOut(app);
	// });

	// await t.step("submitSignInValidationCode", async () => {
	// 	const { app, signIn } = await initMockServer();
	// 	initializeAuth(app);
	// 	await signIn(app);
	// 	const messages: { ns: string; lvl: string; message: Message }[] = [];
	// 	setGlobalLogHandler((ns, lvl, msg) => {
	// 		if (ns === "message-logger") {
	// 			messages.push({ ns, lvl, message: JSON.parse(msg)! });
	// 		}
	// 	});
	// 	const sendResult = await sendSignInValidationCode(
	// 		app,
	// 		"email",
	// 		"john@test.local",
	// 	);
	// 	setGlobalLogHandler(() => {});
	// 	assertEquals(sendResult.sent, true);
	// 	const validationCode = messages[0]?.message.text;
	// 	const confirmResult = await submitSignInValidationCode(
	// 		app,
	// 		validationCode,
	// 	);
	// 	assertEquals(confirmResult.confirmed, true);
	// 	await signOut(app);
	// });

	// await t.step("createAnonymousIdentity", async () => {
	// 	const { app } = await initMockServer();
	// 	initializeAuth(app);
	// 	const result1 = await createAnonymousIdentity(app);
	// 	assertAuthenticationCeremonyResponseTokens(result1);
	// 	await signOut(app);
	// });

	// await t.step("createIdentity", async () => {
	// 	const { app, providers: { identity } } = await initMockServer();
	// 	initializeAuth(app);
	// 	await createIdentity(
	// 		app,
	// 		[{ id: "email", prompt: "jane@test.local" }],
	// 		"en",
	// 	);
	// 	const identity1 = await identity.getByIdentification(
	// 		"email",
	// 		"jane@test.local",
	// 	);
	// 	assertEquals(identity1.components["email"].confirmed, false);
	// 	await signOut(app);
	// });

	// await t.step("createIdentity claims anonymous identity", async () => {
	// 	const { app, providers: { identity } } = await initMockServer();
	// 	initializeAuth(app);
	// 	const result1 = await createAnonymousIdentity(app);
	// 	assertAuthenticationCeremonyResponseTokens(result1);
	// 	const idTokenPayload = decode(result1.id_token.split(".")[1]);
	// 	const idToken = JSON.parse(new TextDecoder().decode(idTokenPayload));
	// 	const anonymousIdentityId = `${idToken.sub}`;
	// 	await createIdentity(
	// 		app,
	// 		[{ id: "email", prompt: "bob@test.local" }],
	// 		"en",
	// 	);
	// 	const identity1 = await identity.getByIdentification(
	// 		"email",
	// 		"bob@test.local",
	// 	);
	// 	assertEquals(identity1.id, anonymousIdentityId);
	// 	await assertRejects(() =>
	// 		createIdentity(
	// 			app,
	// 			[{ id: "email", prompt: "foo@test.local" }],
	// 			"en",
	// 		)
	// 	);
	// 	await signOut(app);
	// });

	// await t.step("addIdentityComponent", async () => {
	// 	const { app } = await initMockServer();
	// 	initializeAuth(app);
	// 	await createAnonymousIdentity(app);
	// 	await addIdentityComponent(app, "email", "nobody@test.local", "en");
	// 	await assertRejects(() =>
	// 		addIdentityComponent(app, "email", "john@test.local", "en")
	// 	);
	// 	await signOut(app);
	// });
});
