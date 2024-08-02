import { generateKeyPair } from "jose";
import { createAuthenticationApplication } from "./authentication.ts";
import { MemoryDocumentProvider, MemoryKVProvider } from "@baseless/inmemory-provider";
import { Server } from "./server.ts";
import { assert } from "@std/assert";
import { isResultSingle } from "../core/result.ts";

Deno.test("Authentication App", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const setupServer = () => {
		const app = createAuthenticationApplication({
			keys: { algo: "PS512", ...keyPair },
			accessTokenTTL: 1000 * 60 * 60,
		});
		const server = new Server(app, {
			kv: new MemoryKVProvider(),
			document: new MemoryDocumentProvider(),
		});
		return { app, server };
	};

	await t.step("signOut", async () => {
		const { server } = setupServer();
		const [result, _] = await server.handleCommand({
			kind: "command",
			rpc: ["authentication", "signOut"],
			input: void 0,
		});
		assert(isResultSingle(result));
		assert(result.value === false);
	});
});
