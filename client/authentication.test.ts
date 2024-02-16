import {
	assert,
	assertEquals,
	assertNotEquals,
	assertRejects,
	assertThrows,
} from "../deps.test.ts";
import { Assert, generateKeyPair } from "../deps.ts";
import { autoid } from "../lib/autoid.ts";
import type { ID } from "../lib/identity/types.ts";
import mock, { MockResult } from "../server/mock.ts";
import { type App, initializeApp } from "./app.ts";
import {
	assertInitializedAuthentication,
	assertPersistence,
	getCeremony,
	getIdentity,
	getIdToken,
	getPersistence,
	initializeAuthentication,
	onAuthenticationStateChange,
	sendPrompt,
	setPersistence,
	signOut,
	submitPrompt,
} from "./authentication.ts";
import type { Message } from "../lib/message/types.ts";
import {
	AuthenticationCeremonyStateNextSchema,
	AuthenticationSubmitPromptStateDoneSchema,
} from "../lib/authentication/types.ts";

Deno.test("Client Authentication", async (t) => {
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	let cachedKeys: Awaited<ReturnType<typeof generateKeyPair>> | undefined;
	const initMockServer = async (): Promise<
		{
			identity: ID;
			app: App;
			signIn: (app: App) => Promise<void>;
			messages: () => Message[];
		} & MockResult
	> => {
		let john: ID;
		const result = await mock(async (r) => {
			if (!cachedKeys) {
				cachedKeys = await generateKeyPair("PS512");
			}
			john = await r.providers.identity.create(
				{},
				[
					{
						id: "email",
						...await r.components.email.configureIdentityComponent(
							"john@test.local",
						),
					},
					{
						id: "password",
						...await r.components.password.configureIdentityComponent("123"),
					},
					{
						id: "otp",
						...await r.components.otp.configureIdentityComponent(null),
					},
				],
			);
			const { publicKey, privateKey } = cachedKeys;
			const email = r.components.email.toCeremonyComponent();
			const password = r.components.password.toCeremonyComponent();
			const otp = r.components.otp.toCeremonyComponent();
			return {
				auth: {
					keys: { algo: "PS512", publicKey, privateKey },
					salt: "foobar",
					allowAnonymousIdentity: true,
					accessTokenTTL: 1_000,
					refreshTokenTTL: 4_000,
					providers: [
						r.components.email,
						r.components.password,
						r.components.otp,
					],
					ceremony: r.components.oneOf(
						r.components.sequence(
							email,
							password,
						),
						r.components.sequence(
							email,
							otp,
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

		initializeAuthentication(app, "http://test.local/api/authentication");

		return {
			...result,
			identity: john!,
			app,
			signIn: async (app) => {
				const result = await submitPrompt(
					app,
					"email",
					"john@test.local",
				);
				Assert(AuthenticationCeremonyStateNextSchema, result);
				await submitPrompt(
					app,
					"password",
					"123",
					result.state,
				);
			},
			messages(): Message[] {
				return result.providers.message.messages;
			},
		};
	};

	await t.step("initializeAuthentication", async () => {
		const { app } = await initMockServer();
		assertInitializedAuthentication(app);
	});

	await t.step("getPersistence", async () => {
		const { app } = await initMockServer();
		const persistence = getPersistence(app);
		assertPersistence(persistence);
	});

	await t.step("setPersistence", async () => {
		const { app } = await initMockServer();
		// deno-lint-ignore no-explicit-any
		assertThrows(() => setPersistence(app, "invalid" as any));
		setPersistence(app, "local");
		assertEquals(getPersistence(app), "local");
		setPersistence(app, "session");
		assertEquals(getPersistence(app), "session");
	});

	await t.step("getCeremony", async () => {
		const { app, components: { email } } = await initMockServer();
		const result = await getCeremony(app);
		Assert(AuthenticationCeremonyStateNextSchema, result);
		assertEquals(result.first, true);
		assertEquals(result.last, false);
		assertEquals(
			result.component,
			email.toCeremonyComponent(),
		);
		await assertRejects(() => getCeremony(app, "invalid"));
	});

	await t.step("submitPrompt", async () => {
		const { app } = await initMockServer();
		const result1 = await submitPrompt(
			app,
			"email",
			"john@test.local",
		);
		Assert(AuthenticationCeremonyStateNextSchema, result1);
		assertEquals(result1.first, false);
		assertEquals(result1.last, false);
		const result2 = await submitPrompt(
			app,
			"password",
			"123",
			result1.state,
		);
		Assert(AuthenticationSubmitPromptStateDoneSchema, result2);
		await signOut(app);
	});

	await t.step("sendPrompt", async () => {
		const { app, messages } = await initMockServer();
		const result1 = await submitPrompt(
			app,
			"email",
			"john@test.local",
		);
		Assert(AuthenticationCeremonyStateNextSchema, result1);
		await sendPrompt(
			app,
			"otp",
			"en",
			result1.state,
		);
		const code = messages().at(-1)?.text;
		assert(code && code.length === 6);
		const result3 = await submitPrompt(
			app,
			"otp",
			code,
			result1.state,
		);
		Assert(AuthenticationSubmitPromptStateDoneSchema, result3);
		await signOut(app);
	});

	await t.step("signOut", async () => {
		const { app, signIn } = await initMockServer();
		await signIn(app);
		await signOut(app);
		await assertRejects(() => signOut(app));
	});

	await t.step("onAuthenticationStateChange", async () => {
		const { app, identity, signIn } = await initMockServer();
		const john = { id: identity.id, meta: identity.meta };
		const changes: (ID | undefined)[] = [];
		const unsubscribe = onAuthenticationStateChange(app, (identity) => {
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
		const { app, signIn } = await initMockServer();
		await signIn(app);
		const idToken = await getIdToken(app);
		assert(idToken?.length ?? 0 > 0);
		await signOut(app);
	});

	await t.step("getIdentity", async () => {
		const { app, identity, signIn } = await initMockServer();
		const john = { id: identity.id, meta: identity.meta };
		await signIn(app);
		const id1 = await getIdentity(app);
		assertEquals(id1, john);
		await signOut(app);
	});

	await t.step("refresh token when needed", async () => {
		const { app, signIn } = await initMockServer();
		await signIn(app);
		const idToken1 = await getIdToken(app);
		assert(idToken1);
		await sleep(2200);
		await getCeremony(app);
		const idToken2 = await getIdToken(app);
		assert(idToken2);
		assertNotEquals(idToken1, idToken2);
		await signOut(app);
	});
});
