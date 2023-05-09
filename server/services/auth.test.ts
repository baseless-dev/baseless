import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { KVIdentityProvider } from "../../providers/identity-kv/mod.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import { AuthenticationService } from "./auth.ts";
import { ConfigurationBuilder } from "../config.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { IdentityService } from "./identity.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { EmailAuthentificationIdenticator } from "../../providers/auth-email/mod.ts";
import { PasswordAuthentificationChallenger } from "../../providers/auth-password/mod.ts";
import * as h from "../../common/authentication/steps/helpers.ts";
import { unwrap } from "../../common/system/result.ts";
import { Message } from "../../common/message/message.ts";
import { setGlobalLogHandler } from "../../common/system/logger.ts";

Deno.test("AuthenticationService", async (t) => {
	const email = h.email({ icon: "", label: {} });
	const password = h.password({ icon: "", label: {} });
	const github = h.action({ type: "github", icon: "", label: {} });

	const config = new ConfigurationBuilder();
	const { publicKey, privateKey } = await generateKeyPair("PS512");
	config.auth()
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar")
		.setFlowStep(
			h.oneOf(
				h.sequence(email, password),
				github,
			),
		)
		.addFlowIdentificator(
			"email",
			new EmailAuthentificationIdenticator(new LoggerMessageProvider()),
		)
		.addFlowChallenger("password", new PasswordAuthentificationChallenger());

	const configuration = config.build();

	const counterProvider = new MemoryCounterProvider();
	const kvProvider = new MemoryKVProvider();
	const identityProvider = new KVIdentityProvider(new MemoryKVProvider());
	const identityService = new IdentityService(
		configuration,
		identityProvider,
		counterProvider,
	);
	const authService = new AuthenticationService(
		configuration,
		identityProvider,
		counterProvider,
		kvProvider,
	);

	const ident1 = unwrap(await identityService.create({}));
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
				step: h.oneOf(email, github),
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
			{
				done: false,
				step: password,
				first: false,
				last: true,
				state: { choices: ["email"], identity: ident1.id },
			},
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
		assertEquals(
			await authService.submitChallenge(
				{ choices: ["email"], identity: ident1.id },
				"password",
				"123",
				"localhost",
			),
			{ done: true, identityId: ident1.id },
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

	let verificationCode = "";
	await t.step("sendIdentificationValidationCode", async () => {
		const messages: { ns: string; lvl: string; message: Message }[] = [];
		setGlobalLogHandler((ns, lvl, msg) => {
			messages.push({ ns, lvl, message: JSON.parse(msg)! });
		});
		await authService.sendIdentificationValidationCode(ident1.id, "email");
		verificationCode = messages.pop()?.message.text ?? "";
		assertEquals(verificationCode.length, 6);
		setGlobalLogHandler(() => {});
	});

	await t.step("confirmIdentificationValidationCode", async () => {
		await assertRejects(() =>
			authService.confirmIdentificationValidationCode(
				ident1.id,
				"email",
				"000000",
			)
		);
		await authService.confirmIdentificationValidationCode(
			ident1.id,
			"email",
			verificationCode,
		);
	});
});
