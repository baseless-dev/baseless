import { assertExists } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { initializeApp, initializeAppWithTransport } from "./app.ts";
import { FetchTransport } from "./transports/mod.ts";

Deno.test("initialize app", async () => {
	const app = await initializeApp({
		baselessUrl: "http://example.org/",
		clientId: "foo",
		clientPublicKey:
			"-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvYSmNTflBIr2Q2z/oVSR+SfhSfelM+ZL/wb+4LenIaRSLdNm8JGD5TI4i1n3qRyPTxbqa70n4Jwx9H8hLMs/qYml0wCEAmrAqqXixku4gz6TtO25D8cXPlquCfNVRO2Dt7CK4ZCUgwVizqJC6+ZIM6fiTI4/rIU6SRb/ZClHuaGspYx4BVW+2AxgzckaojNosiof/7oac4WZck109jCEVE201E8YUumSZtkAxuzFnzPYFKyK4hztpZScSLvvM4Cty7LkwzZLuTkFXgspJ3SzFa6WR9vLleL4GmMBe0Cq8NU8DhdrNgkAt0Ngksf4mFaTpS4p+bKFEdwchVTUzRKlLQIDAQAB-----END PUBLIC KEY-----",
		clientPublicKeyAlg: "RS256",
	});
	assertExists(app.getClientId());
});

Deno.test("initialize app with transport", async () => {
	const app = await initializeAppWithTransport({
		transport: new FetchTransport("http://example.org/"),
		clientId: "foo",
		clientPublicKey:
			"-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvYSmNTflBIr2Q2z/oVSR+SfhSfelM+ZL/wb+4LenIaRSLdNm8JGD5TI4i1n3qRyPTxbqa70n4Jwx9H8hLMs/qYml0wCEAmrAqqXixku4gz6TtO25D8cXPlquCfNVRO2Dt7CK4ZCUgwVizqJC6+ZIM6fiTI4/rIU6SRb/ZClHuaGspYx4BVW+2AxgzckaojNosiof/7oac4WZck109jCEVE201E8YUumSZtkAxuzFnzPYFKyK4hztpZScSLvvM4Cty7LkwzZLuTkFXgspJ3SzFa6WR9vLleL4GmMBe0Cq8NU8DhdrNgkAt0Ngksf4mFaTpS4p+bKFEdwchVTUzRKlLQIDAQAB-----END PUBLIC KEY-----",
		clientPublicKeyAlg: "RS256",
	});
	assertExists(app.getClientId());
});
