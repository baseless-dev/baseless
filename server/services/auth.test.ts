import {
	assert,
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { WebStorageKVProvider } from "../providers/kv-webstorage/mod.ts";
import { KVIdentityProvider } from "../providers/identity-kv/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { LoggerEmailProvider } from "../providers/email-logger/mod.ts";
import { AuthenticationService } from "./auth.ts";
import { assertAutoId } from "../../shared/autoid.ts";
import { ConfigurationBuilder } from "../config.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import * as f from "../auth/flow.ts";
import { IdentityService } from "./identity.ts";
import { CounterService } from "./counter.ts";
import { AssetService } from "./asset.ts";
import { LocalAssetProvider } from "../providers/asset-local/mod.ts";
import { NonExtendableContext } from "../context.ts";
import { KVService } from "./kv.ts";
import { MemoryKVProvider } from "../providers/kv-memory/mod.ts";
import { AuthenticationIdenticator } from "../auth/config.ts";
import { EmailAuthentificationIdenticator } from "../auth/identicators/email.ts";

Deno.test("AuthenticationService", async (t) => {
	const email = f.email({ icon: "", label: {} });
	const password = f.password({ icon: "", label: {} });
	const github = f.action({ type: "github", icon: "", label: {} });
	const otp = f.otp({ type: "otp", icon: "", label: {} });

	const config = new ConfigurationBuilder();
	const { publicKey, privateKey } = await generateKeyPair("PS512");
	config.auth()
		.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
		.setSecuritySalt("foobar")
		.setFlowStep(
			f.oneOf(
				f.sequence(email, password, otp),
				github,
			),
		)
		.addFlowIdentificator("email", new EmailAuthentificationIdenticator());

	const configuration = config.build();
	const identityService = new IdentityService(
		configuration,
		new KVIdentityProvider(
			new WebStorageKVProvider(
				sessionStorage,
				import.meta.url + "createIdentity",
			),
		),
	);
	const counterService = new CounterService(new MemoryCounterProvider());
	const kvService = new KVService(new MemoryKVProvider());
	const authService = new AuthenticationService(
		configuration,
		identityService,
		counterService,
		kvService,
	);
	const assetService = new AssetService(
		new LocalAssetProvider(import.meta.resolve("./")),
	);

	const context: NonExtendableContext = {
		config: configuration,
		asset: assetService,
		counter: counterService,
		kv: kvService,
		identity: identityService,
	};

	const ident1 = await identityService.create({});
	await identityService.createIdentification({
		identityId: ident1.id,
		type: "email",
		identification: "john@test.local",
		verified: false,
		meta: {},
	});

	await t.step("getStep", async () => {
		assertEquals(
			await authService.getStep(context),
			{
				done: false,
				step: f.oneOf(email, github),
				first: true,
				last: false,
			},
		);
		assertEquals(
			await authService.getStep(context, { choices: ["email"] }),
			{
				done: false,
				step: password,
				first: false,
				last: false,
			},
		);
		assertEquals(
			await authService.getStep(context, { choices: ["github"] }),
			{
				done: true,
			},
		);
		assertEquals(
			await authService.getStep(context, {
				choices: ["email", "password"],
			}),
			{
				done: false,
				step: otp,
				first: false,
				last: true,
			},
		);
		assertEquals(
			await authService.getStep(context, {
				choices: ["email", "password", "otp"],
			}),
			{
				done: true,
			},
		);
	});

	await t.step("submitIdentification", async () => {
		{
			const body = new FormData();
			body.set("email", "john@test.local");
			const req = new Request("http://test.local", { method: "POST", body });
			assertEquals(
				await authService.submitIdentification(
					context,
					{ choices: [] },
					"email",
					req,
				),
				{ choices: ["email"], identity: ident1.id },
			);
		}
		{
			const body = new FormData();
			body.set("email", "nobody@test.local");
			const req = new Request("http://test.local", { method: "POST", body });
			await assertRejects(() =>
				authService.submitIdentification(context, { choices: [] }, "email", req)
			);
		}
	});
});
