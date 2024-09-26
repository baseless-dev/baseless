#!/usr/bin/env -S deno serve
// deno-lint-ignore-file require-await
import { generateKeyPair } from "jose";
import { MemoryDocumentProvider, MemoryEventProvider, MemoryKVProvider, MemoryNotificationProvider } from "@baseless/inmemory-provider";
import { DenoHubProvider } from "@baseless/deno-provider/hub";
import { id, ksuid } from "@baseless/core/id";
import {
	ApplicationBuilder,
	component,
	configureAuthentication,
	EmailIdentityComponentProvider,
	PasswordIdentityComponentProvider,
	Permission,
	sequence,
	Server,
	Type,
} from "@baseless/server";

const keyPair = await generateKeyPair("PS512");

const kvProvider = new MemoryKVProvider();
const documentProvider = new MemoryDocumentProvider();
const hubProvider = new DenoHubProvider();
const eventProvider = new MemoryEventProvider(hubProvider);
const notificationProvider = new MemoryNotificationProvider();
const emailProvider = new EmailIdentityComponentProvider();
const passwordProvider = new PasswordIdentityComponentProvider("lesalt");

let ref = 0;
const appBuilder = new ApplicationBuilder()
	.use(configureAuthentication({
		keys: { ...keyPair, algo: "PS512" },
		ceremony: sequence(component("email"), component("password")),
		identityComponentProviders: {
			email: emailProvider,
			password: passwordProvider,
		},
		notificationProvider,
	}))
	.rpc(["hello", "{world}"], {
		input: Type.Void(),
		output: Type.TemplateLiteral([Type.Number(), Type.Literal(". Hello "), Type.String()]),
		security: async () => Permission.All,
		handler: async ({ params }) => `${++ref}. Hello ${params.world}`,
	})
	.collection(["items"], {
		schema: Type.String(),
		security: async ({ context }) => context.currentSession ? Permission.All : Permission.None,
	})
	.onHubConnect(async ({ context, hubId }) => {
		console.log("connected", { hubId, identityId: context.currentSession?.identityId });
	})
	.onHubDisconnect(async ({ context, hubId }) => {
		console.log("disconnected", { hubId, identityId: context.currentSession?.identityId });
	})
	.emits(["message"], {
		payload: Type.String(),
		security: async ({ context }) => Permission.All,
	})
	.onEvent(["message"], async ({ context, payload }) => {
		console.log("message", { identityId: context.currentSession?.identityId, message: payload });
	});

const app = appBuilder.build();

const dummyIdentityId = id("id_");
documentProvider.atomic()
	.set(["identities", dummyIdentityId], { identityId: dummyIdentityId })
	.set(["identities", dummyIdentityId, "components", "email"], {
		identityId: dummyIdentityId,
		componentId: "email",
		identification: "foo@test.local",
		confirmed: true,
		data: {},
	})
	.set(["identities", dummyIdentityId, "components", "password"], {
		identityId: dummyIdentityId,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await passwordProvider.hashPassword("123"),
		},
	})
	.set(["identifications", "email", "foo@test.local"], dummyIdentityId)
	.set(["items", "1"], "One")
	.set(["items", "2"], "Two")
	.set(["items", "3"], "Three")
	.set(["items", "4"], "Four")
	.commit();

const server = new Server({
	application: app,
	document: documentProvider,
	event: eventProvider,
	hub: hubProvider,
	kv: kvProvider,
});

export { appBuilder };

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
		// response.headers.set("Access-Control-Allow-Origin", req.headers.get("Origin") ?? "*");
		// response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
		// response.headers.set("Access-Control-Allow-Headers", "*");
		return response;
	},
} satisfies Deno.ServeDefaultExport;
