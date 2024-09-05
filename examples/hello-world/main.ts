#!/usr/bin/env -S deno serve
// deno-lint-ignore-file require-await
import { ApplicationBuilder, Permission, Server } from "../../server/mod.ts";
import { MemoryDocumentProvider, MemoryKVProvider } from "../../inmemory-provider/mod.ts";
import { Type } from "npm:@sinclair/typebox@0.33.7";

const kvProvider = new MemoryKVProvider();
const documentProvider = new MemoryDocumentProvider();

let ref = 0;
const appBuilder = new ApplicationBuilder()
	.rpc(["hello", "{world}"], {
		input: Type.Void(),
		output: Type.TemplateLiteral([Type.Number(), Type.Literal(". Hello "), Type.String()]),
		security: async () => Permission.All,
		handler: async ({ params }) => `${++ref}. Hello ${params.world}`,
	});

const app = appBuilder.build();

const server = new Server({
	application: app,
	document: documentProvider,
	kv: kvProvider,
});

export default {
	async fetch(req): Promise<Response> {
		if (req.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
					"Access-Control-Allow-Methods": "POST, OPTIONS",
					"Access-Control-Allow-Headers": "*",
				},
			});
		}
		const [response, _promises] = await server.handleRequest(req);
		response.headers.set("Access-Control-Allow-Origin", req.headers.get("Origin") ?? "*");
		response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
		response.headers.set("Access-Control-Allow-Headers", "*");
		return response;
	},
} satisfies Deno.ServeDefaultExport;
