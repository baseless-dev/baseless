import { generateKeyPair } from "npm:jose@5.2.0";
import { Assert } from "../lib/typebox.ts";
import { ruid } from "../lib/autoid.ts";
import type { ID } from "../lib/identity/types.ts";
import mock, { type MockResult } from "../server/mock.ts";
import { type App, initializeApp } from "./app.ts";
import {
	getCeremony,
	initializeRegistration,
	submitPrompt,
	submitValidationCode,
} from "./registration.ts";
import type { Notification } from "../lib/notification/types.ts";
import { assertInitializedRegistration } from "./registration.ts";
import {
	RegistrationCeremonyStateNextSchema,
} from "../lib/registration/types.ts";
import {
	assert,
	assertEquals,
	assertObjectMatch,
	assertRejects,
} from "https://deno.land/std@0.213.0/assert/mod.ts";
import { sendValidationCode } from "./registration.ts";
import { initializeAuthentication, signOut } from "./authentication.ts";

Deno.test("Client Registration", async (t) => {
	let cachedKeys: Awaited<ReturnType<typeof generateKeyPair>> | undefined;
	const initMockServer = async (): Promise<
		{
			identity: ID;
			app: App;
			notifications: () => Notification[];
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
						confirmed: true,
					},
					{
						id: "password",
						...await r.components.password.configureIdentityComponent("123"),
					},
					{
						id: "otp",
						confirmed: true,
						meta: {},
					},
				],
			);
			const { publicKey, privateKey } = cachedKeys;
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
							r.components.email.toCeremonyComponent(),
							r.components.password.toCeremonyComponent(),
						),
						r.components.sequence(
							r.components.email.toCeremonyComponent(),
							r.components.otp.toCeremonyComponent(),
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
		initializeRegistration(app, "http://test.local/api/registration");

		return {
			...result,
			identity: john!,
			app,
			notifications(): Notification[] {
				return result.providers.notification.notifications;
			},
		};
	};

	await t.step("initializeRegistration", async () => {
		const { app } = await initMockServer();
		assertInitializedRegistration(app);
	});

	await t.step("getCeremony", async () => {
		const { app, components: { email } } = await initMockServer();
		const result = await getCeremony(app);
		Assert(RegistrationCeremonyStateNextSchema, result);
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
		const state1 = await submitPrompt(
			app,
			"email",
			"jane@test.local",
		);
		Assert(RegistrationCeremonyStateNextSchema, state1);
		assertObjectMatch(state1, {
			done: false,
			first: false,
			last: false,
			validating: true,
			component: {
				kind: "prompt",
				id: "email",
			},
		});
	});

	await t.step("send validation code", async () => {
		const { app, notifications } = await initMockServer();
		const state1 = await submitPrompt(
			app,
			"email",
			"jane@test.local",
		);
		Assert(RegistrationCeremonyStateNextSchema, state1);
		assertEquals(await sendValidationCode(app, "email", "en", state1.state), {
			sent: true,
		});
		const code = notifications().at(-1)?.content["text/x-otp-code"];
		assert(code?.length === 8);
	});

	await t.step("submit validation code", async () => {
		const { app, notifications } = await initMockServer();

		const state1 = await submitPrompt(app, "email", "jane@test.local");
		assert(state1.done === false);
		await sendValidationCode(app, "email", "en", state1.state);
		const code = notifications().at(-1)!.content["text/x-otp-code"];
		const state2 = await submitValidationCode(
			app,
			"email",
			code,
			state1.state,
		);
		Assert(RegistrationCeremonyStateNextSchema, state2);
	});

	await t.step("submit last prompt returns an identity", async () => {
		const { app, notifications } = await initMockServer();

		const state1 = await submitPrompt(app, "email", "jane@test.local");
		assert(state1.done === false);
		await sendValidationCode(app, "email", "en", state1.state);
		const code = notifications().at(-1)!.content["text/x-otp-code"];
		const state2 = await submitValidationCode(
			app,
			"email",
			code,
			state1.state,
		);
		assert(state2.done === false);
		const state3 = await submitPrompt(app, "password", "123", state2.state);
		assert(state3.done === true);
		await signOut(app);
	});
});
