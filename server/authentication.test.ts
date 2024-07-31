import { generateKeyPair } from "jose";
import { createAuthenticationApplication } from "./authentication.ts";
import { MemoryKVProvider } from "@baseless/kv-memory";
import { Server } from "./server.ts";
import { assert } from "@std/assert";
import { isResultSingle } from "../core/result.ts";

Deno.test("Authentication App", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const setupServer = () => {
		const app = createAuthenticationApplication({
			keys: { algo: "PS512", ...keyPair },
			kvProvider: new MemoryKVProvider(),
		});
		const server = new Server(app);
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
