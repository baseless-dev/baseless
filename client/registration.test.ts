// import { Assert, generateKeyPair } from "../deps.ts";
// import { autoid } from "../lib/autoid.ts";
// import type { ID } from "../lib/identity/types.ts";
// import mock, { type MockResult } from "../server/mock.ts";
// import { type App, initializeApp } from "./app.ts";
// import {
// 	getCeremony,
// 	initializeRegistration,
// 	submitPrompt,
// 	submitValidationCode,
// } from "./registration.ts";
// import type { Message } from "../lib/message/types.ts";
// import { assertInitializedRegistration } from "./registration.ts";
// import {
// 	RegistrationCeremonyStateNextSchema,
// 	RegistrationCeremonyStateValidationSchema,
// } from "../lib/registration/types.ts";
// import {
// 	assert,
// 	assertEquals,
// 	assertObjectMatch,
// 	assertRejects,
// } from "../deps.test.ts";
// import { sendValidationCode } from "./registration.ts";

// Deno.test("Client Registration", async (t) => {
// 	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 	let cachedKeys: Awaited<ReturnType<typeof generateKeyPair>> | undefined;
// 	const initMockServer = async (): Promise<
// 		{
// 			identity: ID;
// 			app: App;
// 			messages: () => Message[];
// 		} & MockResult
// 	> => {
// 		let john: ID;
// 		const result = await mock(async (r) => {
// 			if (!cachedKeys) {
// 				cachedKeys = await generateKeyPair("PS512");
// 			}
// 			john = await r.providers.identity.create(
// 				{},
// 				[
// 					{
// 						id: "email",
// 						identification: "john@test.local",
// 						confirmed: true,
// 						meta: {},
// 					},
// 					{
// 						id: "password",
// 						...await r.components.password.initializeIdentityComponent(
// 							{ value: "123" },
// 						),
// 					},
// 					{
// 						id: "otp",
// 						confirmed: true,
// 						meta: {},
// 					},
// 				],
// 			);
// 			const { publicKey, privateKey } = cachedKeys;
// 			return {
// 				auth: {
// 					keys: { algo: "PS512", publicKey, privateKey },
// 					salt: "foobar",
// 					allowAnonymousIdentity: true,
// 					accessTokenTTL: 1_000,
// 					refreshTokenTTL: 4_000,
// 					ceremony: r.components.oneOf(
// 						r.components.sequence(
// 							r.components.email,
// 							r.components.password,
// 						),
// 						r.components.sequence(
// 							r.components.email,
// 							r.components.otp,
// 						),
// 					),
// 					components: [
// 						r.components.email,
// 						r.components.password,
// 						r.components.otp,
// 					],
// 				},
// 			};
// 		});

// 		const routeHandler = await result.router.build();

// 		const app = initializeApp({
// 			clientId: autoid(),
// 			apiEndpoint: "http://test.local/api",
// 			async fetch(input, init): Promise<Response> {
// 				const request = new Request(input, init);
// 				return await routeHandler(
// 					request,
// 				);
// 			},
// 		});

// 		initializeRegistration(app, "http://test.local/api/registration");

// 		return {
// 			...result,
// 			identity: john!,
// 			app,
// 			messages(): Message[] {
// 				return result.providers.message.messages;
// 			},
// 		};
// 	};

// 	await t.step("initializeRegistration", async () => {
// 		const { app } = await initMockServer();
// 		assertInitializedRegistration(app);
// 	});

// 	// await t.step("getCeremony", async () => {
// 	// 	const { app, components: { email } } = await initMockServer();
// 	// 	const result = await getCeremony(app);
// 	// 	Assert(RegistrationCeremonyStateNextSchema, result);
// 	// 	assertEquals(result.first, true);
// 	// 	assertEquals(result.last, false);
// 	// 	assertEquals(
// 	// 		result.component,
// 	// 		JSON.parse(JSON.stringify(email)),
// 	// 	);
// 	// 	await assertRejects(() => getCeremony(app, "invalid"));
// 	// });

// 	// await t.step("submitPrompt", async () => {
// 	// 	const { app } = await initMockServer();
// 	// 	const state1 = await submitPrompt(
// 	// 		app,
// 	// 		"email",
// 	// 		"john@test.local",
// 	// 	);
// 	// 	Assert(RegistrationCeremonyStateValidationSchema, state1);
// 	// 	assertEquals(state1.first, false);
// 	// 	assertEquals(state1.last, false);
// 	// 	assertObjectMatch(state1.validation, {
// 	// 		id: "validation",
// 	// 		kind: "prompt",
// 	// 		prompt: "otp",
// 	// 	});
// 	// });

// 	// await t.step("send validation code", async () => {
// 	// 	const { app, messages } = await initMockServer();
// 	// 	const state1 = await submitPrompt(
// 	// 		app,
// 	// 		"email",
// 	// 		"john@test.local",
// 	// 	);
// 	// 	Assert(RegistrationCeremonyStateValidationSchema, state1);
// 	// 	assertEquals(await sendValidationCode(app, "email", "en", state1.state), {
// 	// 		sent: true,
// 	// 	});
// 	// 	const code = messages().at(-1)?.text;
// 	// 	assert(code?.length === 8);
// 	// });

// 	// await t.step("submit validation code", async () => {
// 	// 	const { app, messages } = await initMockServer();

// 	// 	const state1 = await submitPrompt(app, "email", "john@test.local");
// 	// 	assert(state1.done === false);
// 	// 	await sendValidationCode(app, "email", "en", state1.state);
// 	// 	const code = messages().at(-1)!.text;
// 	// 	const state2 = await submitValidationCode(
// 	// 		app,
// 	// 		"email",
// 	// 		code,
// 	// 		state1.state,
// 	// 	);
// 	// 	Assert(RegistrationCeremonyStateNextSchema, state2);
// 	// });

// 	// await t.step("submit last prompt returns an identity", async () => {
// 	// 	const { app, messages } = await initMockServer();

// 	// 	const state1 = await submitPrompt(app, "email", "john@test.local");
// 	// 	assert(state1.done === false);
// 	// 	await sendValidationCode(app, "email", "en", state1.state);
// 	// 	const code = messages().at(-1)!.text;
// 	// 	const state2 = await submitValidationCode(
// 	// 		app,
// 	// 		"email",
// 	// 		code,
// 	// 		state1.state,
// 	// 	);
// 	// 	assert(state2.done === false);
// 	// 	const state3 = await submitPrompt(app, "password", "123", state2.state);
// 	// 	assert(state3.done === true);
// 	// });
// });
