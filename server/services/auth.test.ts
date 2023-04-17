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
		);

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
	const authService = new AuthenticationService(
		configuration,
		identityService,
		counterService,
	);
	const assetService = new AssetService(
		new LocalAssetProvider(import.meta.resolve("./")),
	);

	const request = new Request("http://test.local/");
	const context: NonExtendableContext = {
		config: configuration,
		asset: assetService,
	};

	await t.step("getStep", async () => {
		assertEquals(
			await authService.getStep(request, context),
			{
				done: false,
				value: f.oneOf(email, github),
			},
		);
		assertEquals(
			await authService.getStep(request, context, { choices: ["email"] }),
			{
				done: false,
				value: password,
			},
		);
		assertEquals(
			await authService.getStep(request, context, { choices: ["github"] }),
			{
				done: true,
				value: undefined,
			},
		);
		assertEquals(
			await authService.getStep(request, context, {
				choices: ["email", "password"],
			}),
			{
				done: false,
				value: otp,
			},
		);
		assertEquals(
			await authService.getStep(request, context, {
				choices: ["email", "password", "otp"],
			}),
			{
				done: true,
				value: undefined,
			},
		);
	});

	await t.step("submitIdentification", async () => {
	});
});
