import { assert, assertEquals } from "@std/assert";
import { Application } from "./application.ts";
import { Server } from "./server.ts";
import { Type } from "@sinclair/typebox";
import { isResultError, isResultSingle } from "@baseless/core/result";

Deno.test("Server", async (t) => {
	const app = new Application()
		.rpc(["hello"], {
			input: Type.String(),
			output: Type.String(),
			handler: async ({ input }) => {
				return input;
			},
			security: async () => {
				return "allow";
			},
		});
	await t.step("handle command", async () => {
		const server = new Server(app);
		const [result, promises] = await server.handleCommand({
			kind: "command",
			rpc: ["hello"],
			input: "world",
		});
		assert(isResultSingle(result));
		assertEquals(result.value, "world");
		assertEquals(promises.length, 0);
	});
	await t.step("handle request", async () => {
		const server = new Server(app);
		{
			const [response, promises] = await server.handleRequest(
				new Request("https://local", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						kind: "command",
						rpc: ["not found"],
						input: "silence is golden",
					}),
				}),
			);
			assertEquals(response.status, 500);
			assertEquals(promises.length, 0);
			const result = await response.json();
			assert(isResultError(result));
			assertEquals(result.error, "not_found");
		}
		{
			const [response, promises] = await server.handleRequest(
				new Request("https://local", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						kind: "command",
						rpc: ["hello"],
						input: "world",
					}),
				}),
			);
			assertEquals(response.status, 200);
			assertEquals(promises.length, 0);
			const result = await response.json();
			assert(isResultSingle(result));
			assertEquals(result.value, "world");
		}
	});
	await t.step("handle websocket", async () => {
		const server = new Server(app);
		const [response, promises] = await server.handleRequest(
			new Request("https://local", {
				method: "POST",
				headers: {
					"Upgrade": "websocket",
					"Sec-WebSocket-Protocol":
						"base64url.bearer.authorization.baseless.dev.bXl0b2tlbg",
				},
			}),
		);
		assertEquals(response.status, 501);
		assertEquals(promises.length, 0);
	});
});
