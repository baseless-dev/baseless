import { Assert, generateKeyPair } from "../deps.ts";
import { autoid } from "../lib/autoid.ts";
import type { ID } from "../lib/identity/types.ts";
import mock, { type MockResult } from "../server/mock.ts";
import { type App, initializeApp } from "./app.ts";
import { getCeremony, initializeRegistration } from "./registration.ts";
import type { Message } from "../lib/message/types.ts";
import { assertInitializedRegistration } from "./registration.ts";
import { RegistrationCeremonyStateNextSchema } from "../lib/registration/types.ts";
import { assertEquals, assertRejects } from "../deps.test.ts";
import { submitPrompt } from "./authentication.ts";

Deno.test("Client Registration", async (t) => {
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	let cachedKeys: Awaited<ReturnType<typeof generateKeyPair>> | undefined;
	const initMockServer = async (): Promise<
		{
			identity: ID;
			app: App;
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
						identification: "john@test.local",
						confirmed: true,
						meta: {},
					},
					{
						id: "password",
						...await r.components.password.initializeIdentityComponent(
							{ value: "123" },
						),
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

		initializeRegistration(app, "http://test.local/api/registration");

		return {
			...result,
			identity: john!,
			app,
			messages(): Message[] {
				return result.providers.message.messages;
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
			JSON.parse(JSON.stringify(email)),
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
		Assert(RegistrationCeremonyStateNextSchema, result1);
		assertEquals(result1.first, false);
		assertEquals(result1.last, false);
	});
});
