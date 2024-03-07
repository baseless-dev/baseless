import {
	assert,
	assertEquals,
	assertNotEquals,
	assertRejects,
	assertThrows,
} from "https://deno.land/std@0.213.0/assert/mod.ts";
// import { generateKeyPair } from "npm:jose@5.2.0";
import { Assert } from "../lib/typebox.ts";
import { ruid } from "../lib/autoid.ts";
import type { ID } from "../lib/identity/types.ts";
import mock from "../server/mock.ts";
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
import type { Notification } from "../lib/notification/types.ts";
import {
	AuthenticationCeremonyStateNextSchema,
	AuthenticationSubmitPromptStateDoneSchema,
	oneOf,
	sequence,
} from "../lib/authentication/types.ts";

Deno.test("Client Authentication", async (t) => {
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const initMockServer = async (): Promise<
		{
			identity: ID;
			app: App;
			signIn: (app: App) => Promise<void>;
			notifications: () => Notification[];
			codes: () => string[];
		} & Awaited<ReturnType<typeof mock>>
	> => {
		let john: ID;
		const result = await mock(async ({
			identityProvider,
			emailProvider,
			passwordProvider,
			otpProvider,
			authenticationConfiguration,
		}) => {
			john = await identityProvider.create(
				{},
				[
					{
						id: "email",
						...await emailProvider.configureIdentityComponent(
							"john@test.local",
						),
						confirmed: true,
					},
					{
						id: "password",
						...await passwordProvider.configureIdentityComponent("123"),
					},
					{
						id: "otp",
						...await otpProvider.configureIdentityComponent(null),
					},
				],
			);
			const email = emailProvider.toCeremonyComponent();
			const password = passwordProvider.toCeremonyComponent();
			const otp = otpProvider.toCeremonyComponent();
			authenticationConfiguration = authenticationConfiguration
				.setAllowAnonymousIdentity(true)
				.setAccessTokenTTL(1_000)
				.setRefreshTokenTTL(4_000)
				.setCeremony(oneOf(
					sequence(
						email,
						password,
					),
					sequence(
						email,
						otp,
					),
				));
			return {
				authenticationConfiguration,
			};
		});

		const routeHandler = await result.router.build();

		const app = initializeApp({
			clientId: ruid(),
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
			notifications(): Notification[] {
				return result.notificationProvider.notifications;
			},
			codes(): string[] {
				return result.otpProvider.codes;
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
		const { app, emailProvider } = await initMockServer();
		const result = await getCeremony(app);
		Assert(AuthenticationCeremonyStateNextSchema, result);
		assertEquals(result.first, true);
		assertEquals(result.last, false);
		assertEquals(
			result.component,
			emailProvider.toCeremonyComponent(),
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
		const { app, codes } = await initMockServer();
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
		const code = codes().at(-1);
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
