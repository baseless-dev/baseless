import {
	component,
	EmailIdentityComponentProvider,
	Identity,
	IdentityComponent,
	Notification,
	PasswordIdentityComponentProvider,
	sequence,
	TDefinition,
} from "@baseless/server";
import createMemoryServer, { serve } from "../server/server.test.ts";
import { generateKeyPair } from "jose";
import { id } from "@baseless/core/id";
import { Client } from "./client.ts";

let keyPair: Awaited<ReturnType<typeof generateKeyPair>> | undefined;

export default async function createMemoryClientServer(app: Record<string, TDefinition>, websocket = false): Promise<
	& Awaited<ReturnType<typeof createMemoryServer>>
	& { client: Client; identity: Identity }
	& AsyncDisposable
> {
	keyPair ??= await generateKeyPair("PS512");
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
	const mock = await createMemoryServer(app, {
		algo: "PS512",
		privateKey: keyPair.privateKey,
		publicKey: keyPair.publicKey,
		ceremony: sequence(component("email"), component("password")),
		components: { email, password },
		accessTokenTTL: 1000,
		refreshTokenTTL: 10_000,
	});

	const identity = {
		id: id("id_"),
		data: {
			firstName: "Foo",
			lastName: "Bar",
		},
	} satisfies Identity;
	const identityComponentEmail = {
		identityId: identity.id,
		componentId: "email",
		identification: "foo@test.local",
		confirmed: true,
		data: {},
	} satisfies IdentityComponent;
	const identityComponentPassword = {
		identityId: identity.id,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await password.hashPassword("lepassword"),
		},
	} satisfies IdentityComponent;

	await mock.service.document.atomic()
		.set(`auth/identity/${identity.id}`, identity)
		.set(`auth/identity/${identity.id}/component/${identityComponentEmail.componentId}`, identityComponentEmail)
		.set(`auth/identity/${identity.id}/component/${identityComponentPassword.componentId}`, identityComponentPassword)
		.set(`post/a`, "A")
		.set(`post/b`, "B")
		.set(`post/c`, "C")
		.commit();

	// Manually consume the 7 document/set events caused by the atomic operation
	{
		const consumer = mock.provider.queue.dequeue();
		const reader = consumer.getReader();
		for (let i = 7; i-- > 0;) {
			await reader.read();
		}
		reader.releaseLock();
		consumer.cancel();
	}

	const server = websocket ? await serve(mock.server) : undefined;

	const client = server
		? new Client({
			apiEndpoint: server.url.toString(),
			clientId: "test",
		})
		: new Client({
			apiEndpoint: "http://local",
			clientId: "test",
			fetch: async (input, init): Promise<Response> => {
				const [response, promises] = await mock.server.handleRequest(new Request(input, init));
				await Promise.allSettled(promises);
				return response;
			},
		});

	return {
		...mock,
		client,
		identity,
		[Symbol.asyncDispose]: async () => {
			await client[Symbol.asyncDispose]();
			server?.[Symbol.dispose]();
			mock[Symbol.dispose]();
		},
	};
}
