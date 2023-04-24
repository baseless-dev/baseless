import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { KVIdentityProvider } from "../providers/identity-kv/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { LoggerMessageProvider } from "../providers/message-logger/mod.ts";
import { AuthenticationService } from "./auth.ts";
import { ConfigurationBuilder } from "../config.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import * as f from "../auth/flow.ts";
import { IdentityService } from "./identity.ts";
import { CounterService } from "./counter.ts";
import { AssetService } from "./asset.ts";
import { LocalAssetProvider } from "../providers/asset-local/mod.ts";
import { Context } from "../context.ts";
import { KVService } from "./kv.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { EmailAuthentificationIdenticator } from "../auth/identicators/email.ts";
import { PasswordAuthentificationChallenger } from "../auth/identicators/password.ts";
import { assertSessionData } from "../providers/session.ts";
import { SessionService } from "./session.ts";
import { KVSessionProvider } from "../providers/session-kv/mod.ts";

Deno.test("AuthenticationService", async (t) => {
	const email = f.email({ icon: "", label: {} });
	const password = f.password({ icon: "", label: {} });
	const github = f.action({ type: "github", icon: "", label: {} });

	const config = new ConfigurationBuilder();
	const { publicKey, privateKey } = await generateKeyPair("PS512");
	config.auth()
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar")
		.setFlowStep(
			f.oneOf(
				f.sequence(email, password),
				github,
			),
		)
		.addFlowIdentificator(
			"email",
			new EmailAuthentificationIdenticator(new LoggerMessageProvider()),
		)
		.addFlowChallenger("password", new PasswordAuthentificationChallenger());

	const configuration = config.build();

	const assetProvider = new LocalAssetProvider(import.meta.resolve("./"));
	const assetService = new AssetService(assetProvider);
	const counterProvider = new MemoryCounterProvider();
	const counterService = new CounterService(counterProvider);
	const kvProvider = new MemoryKVProvider();
	const kvService = new KVService(kvProvider);
	const identityProvider = new KVIdentityProvider(new MemoryKVProvider());
	const identityService = new IdentityService(configuration, identityProvider);
	const sessionProvider = new KVSessionProvider(new MemoryKVProvider());
	const sessionService = new SessionService(configuration, sessionProvider);

	const context: Context = {
		config: configuration,
		asset: assetService,
		counter: counterService,
		kv: kvService,
		identity: identityService,
		session: sessionService,
		waitUntil() {},
	};
	const authService = new AuthenticationService(configuration, context);

	const ident1 = await identityService.create({});
	await identityService.createIdentification({
		identityId: ident1.id,
		type: "email",
		identification: "john@test.local",
		verified: false,
		meta: {},
	});
	await identityService.createChallenge(
		ident1.id,
		"password",
		"123",
	);

	await t.step("getStep", async () => {
		assertEquals(
			await authService.getStep(),
			{
				done: false,
				step: f.oneOf(email, github),
				first: true,
				last: false,
			},
		);
		assertEquals(
			await authService.getStep({ choices: ["email"] }),
			{
				done: false,
				step: password,
				first: false,
				last: true,
			},
		);
		assertEquals(
			await authService.getStep({ choices: ["github"] }),
			{
				done: true,
			},
		);
		assertEquals(
			await authService.getStep({
				choices: ["email", "password"],
			}),
			{
				done: true,
			},
		);
	});

	await t.step("submitIdentification", async () => {
		assertEquals(
			await authService.submitIdentification(
				{ choices: [] },
				"email",
				"john@test.local",
				"localhost",
			),
			{ choices: ["email"], identity: ident1.id },
		);
		await assertRejects(() =>
			authService.submitIdentification(
				{ choices: [] },
				"email",
				"unknown@test.local",
				"localhost",
			)
		);
	});

	await t.step("submitChallenge", async () => {
		assertSessionData(
			await authService.submitChallenge(
				{ choices: ["email"], identity: ident1.id },
				"password",
				"123",
				"localhost",
			),
		);
		await assertRejects(() =>
			authService.submitChallenge(
				{ choices: [], identity: ident1.id },
				"password",
				"123",
				"localhost",
			)
		);
		await assertRejects(() =>
			authService.submitChallenge(
				{ choices: ["email"], identity: ident1.id },
				"password",
				"abc",
				"localhost",
			)
		);
	});
});
