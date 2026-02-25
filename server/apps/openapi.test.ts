import createMemoryServer from "../server.test.ts";
import { app } from "../app.ts";
import authApp from "./authentication.ts";
import openapiApp from "./openapi.ts";
import { generateKeyPair } from "jose";
import { id } from "@baseless/core/id";
import * as z from "@baseless/core/schema";
import { assert } from "@std/assert/assert";
import { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
import { EmailIdentityComponentProvider } from "../auth/email.ts";
import { PasswordIdentityComponentProvider } from "../auth/password.ts";
import { component, sequence } from "@baseless/core/authentication-ceremony";
import { OtpComponentProvider } from "../auth/otp.ts";
import { Notification } from "@baseless/core/notification";
import { PolicyIdentityComponentProvider } from "../auth/policy.ts";
import { assertRejects } from "@std/assert/rejects";
import { ref } from "@baseless/core/ref";

Deno.test("OpenAPI", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const email = new EmailIdentityComponentProvider({
		sendValidationNotification({ code }): Notification {
			return {
				subject: "Your verification code",
				content: {
					"text/x-code": `${code}`,
				},
			};
		},
	});
	const password = new PasswordIdentityComponentProvider("dummy salt");
	using mock = await createMemoryServer({
		publicKey: keyPair.publicKey,
		app: app()
			// .extend(authApp)
			.extend(openapiApp)
			.endpoint({
				path: "users/:userid",
				request: z.jsonRequest({
					token: z.string().meta({ id: "RefreshToken" }),
				}),
				response: z.jsonResponse({
					result: z.string(),
				}),
				handler: async ({ configuration, request, service }) => {
					throw "TODO!";
				},
			})
			.build(),
		configuration: {
			// auth: {
			// 	accessTokenTTL: 5 * 60 * 1_000,
			// 	authenticationTTL: 5 * 60 * 1_000,
			// 	ceremony: sequence(component("email"), component("password")),
			// 	components: { email, password },
			// 	keyAlgo: "PS512",
			// 	keyPrivate: keyPair.privateKey,
			// 	keyPublic: keyPair.publicKey,
			// 	keySecret: new TextEncoder().encode("2kkAiCQTWisiQOe0SdrppLTW9B8Uxe3n74Ij2BkN4tNrItFRelNt7QWe3kI2NiBs"),
			// 	rateLimit: { limit: 5, period: 5 * 60 * 1_000 },
			// 	refreshTokenTTL: 10 * 60 * 1_000,
			// },
			openapi: {
				info: {
					title: "Test API",
					version: "0.1.0",
				},
			},
		},
	});

	await t.step("schema", async () => {
		const json = await mock.fetch("/openapi.json?ui=swagger", {
			schema: z.unknown(),
			method: "GET",
			headers: {
				"accept": "application/json",
			},
		});

		console.log(Deno.inspect(json, { depth: 100, colors: true }));
	});
});
