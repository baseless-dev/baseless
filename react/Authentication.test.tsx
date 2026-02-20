/// <reference lib="dom" />
/// <reference lib="deno.ns" />
/// <reference lib="esnext" />
/** @jsxImportSource npm:react@19 */
/** @jsxImportSourceTypes npm:@types/react@19 */

import "npm:global-jsdom/register";
// deno-lint-ignore no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { fireEvent, render as _render, type RenderOptions, type RenderResult, waitFor } from "@testing-library/react";
import { assertEquals } from "@std/assert/equals";
import { assert } from "@std/assert/assert";
import authApp from "@baseless/server/applications/authentication";
import { generateKeyPair } from "jose/key/generate/keypair";
import createMemoryServer from "../server/server.test.ts";
import { app } from "@baseless/server";
import { Authentication, AuthenticationPrompt } from "./Authentication.ts";
import { ClientProvider } from "./useClient.ts";
import { Client } from "@baseless/client";
import { EmailIdentityComponentProvider } from "@baseless/server/auth/email";
import { PasswordIdentityComponentProvider } from "@baseless/server/auth/password";
import { component, sequence } from "@baseless/core/authentication-ceremony";
import { id } from "@baseless/core/id";
import { Identity } from "@baseless/core/identity";

Deno.test("Authentication", async (ctx) => {
	const keyPair = await generateKeyPair("PS512");
	const testApp = app()
		.extend(authApp)
		.build();

	async function createMock(): Promise<
		{ server: Awaited<ReturnType<typeof createMemoryServer>>; client: Client; identity: Identity } & AsyncDisposable
	> {
		const email = new EmailIdentityComponentProvider({
			sendValidationNotification: ({ code }) => {
				return {
					subject: "Your verification code",
					content: {
						"text/x-code": `${code}`,
					},
				};
			},
		});
		const password = new PasswordIdentityComponentProvider("dummy salt");
		const server = await createMemoryServer({
			publicKey: keyPair.publicKey,
			app: testApp,
			configuration: {
				auth: {
					accessTokenTTL: 5 * 60 * 1_000,
					authenticationTTL: 5 * 60 * 1_000,
					ceremony: sequence(component("email"), component("password")),
					components: { email, password },
					keyAlgo: "PS512",
					keyPrivate: keyPair.privateKey,
					keyPublic: keyPair.publicKey,
					keySecret: new TextEncoder().encode("2kkAiCQTWisiQOe0SdrppLTW9B8Uxe3n74Ij2BkN4tNrItFRelNt7QWe3kI2NiBs"),
					rateLimit: { limit: 5, period: 5 * 60 * 1_000 },
					refreshTokenTTL: 10 * 60 * 1_000,
				},
			},
		});
		const client = new Client({
			baseUrl: new URL("http://localhost"),
			fetch: async (input, init): Promise<globalThis.Response> => {
				const [response, promises] = await server.server.handleRequest(new globalThis.Request(input, init));
				await Promise.allSettled(promises);
				return response;
			},
		});

		const identity = {
			id: id("id_"),
			data: {
				firstName: "Foo",
				lastName: "Bar",
			},
		};
		const identityComponentEmail = {
			identityId: identity.id,
			componentId: "email",
			identification: "foo@test.local",
			confirmed: true,
			data: {},
		};
		const identityComponentPassword = {
			identityId: identity.id,
			componentId: "password",
			confirmed: true,
			data: {
				hash: await password.hashPassword("lepassword"),
			},
		};

		await server.service.document.atomic()
			.set(`auth/identity/${identity.id}` as never, identity as never)
			.set(`auth/identity/${identity.id}/component/${identityComponentEmail.componentId}` as never, identityComponentEmail as never)
			.set(`auth/identity/${identity.id}/component/${identityComponentPassword.componentId}` as never, identityComponentPassword as never)
			.commit();

		return {
			server,
			client,
			identity,
			[Symbol.asyncDispose]: async () => {
				server[Symbol.dispose]();
				await client[Symbol.asyncDispose]();
			},
		};
	}

	await ctx.step("login", async () => {
		localStorage.clear();
		await using mocked = await createMock();
		using screen = render(<LoginPage client={mocked.client} />);

		const email1 = await screen.findByLabelText("Email");
		await fireEvent.change(email1, { target: { value: "bar@test.local" } });

		await screen.findByText("Clear error");

		const email2 = await screen.findByLabelText("Email");
		await fireEvent.change(email2, { target: { value: "foo@test.local" } });

		const password = await screen.findByLabelText("Password");
		await fireEvent.change(password, { target: { value: "lepassword" } });

		await waitFor(() => assertEquals(mocked.client.credentials.tokens?.identity.id, mocked.identity.id));
	});

	await ctx.step("register", async () => {
		localStorage.clear();
		await using mocked = await createMock();
		using screen = render(<RegistrationPage client={mocked.client} />);

		const email = await screen.findByLabelText("Email");
		await fireEvent.change(email, { target: { value: "foo@test.local" } });

		const send = await screen.findByRole("send");
		await fireEvent.click(send);

		const code = await waitFor(() => {
			const code = mocked.server.provider.notification.notifications[0].content["text/x-code"];
			assert(code);
			return code;
		});

		const otp = await screen.findByLabelText("OTP");
		await fireEvent.change(otp, { target: { value: code } });

		const password = await screen.findByLabelText("Password");
		await fireEvent.change(password, { target: { value: "lepassword" } });

		await waitFor(() => assert(mocked.client.credentials.tokens?.identity.id));
	});
});

function render(ui: React.ReactNode, options?: RenderOptions): RenderResult & Disposable {
	const screen = _render(ui, options);
	return {
		...screen,
		[Symbol.dispose]: () => screen.unmount(),
	};
}

function LoginPage({ client }: { client: Client }): React.ReactNode {
	return (
		<ClientProvider value={client}>
			<section>
				<header>
					<h1>Login</h1>
				</header>
				<AuthSection flow="authentication" />
			</section>
		</ClientProvider>
	);
}

function RegistrationPage({ client }: { client: Client }): React.ReactNode {
	return (
		<ClientProvider value={client}>
			<section>
				<header>
					<h1>Register</h1>
				</header>
				<AuthSection flow="registration" />
			</section>
		</ClientProvider>
	);
}

function AuthSection(props: { flow: "authentication" | "registration" }): React.ReactNode {
	const [error, setError] = React.useState<any>(null);
	return (
		<Authentication identifier="bls-test" flow={props.flow} locale="en">
			{(ceremony) => (
				<>
					<main>
						{error && (
							<div>
								<button role="clearerror" type="button" onClick={(e) => (e.preventDefault(), setError(null))}>Clear error</button>
								<p>{error.name}</p>
							</div>
						)}
						<AuthenticationPrompt
							choice={(ceremony, components) => (
								<ul>
									{components.map((component) => (
										<li>
											<button type="button" onClick={(e) => (e.preventDefault(), ceremony.choose(component.id).catch(setError))}>
												{component.id}
											</button>
										</li>
									))}
								</ul>
							)}
							prompts={{
								email: (ceremony) => (
									<form>
										<label>
											Email
											<input type="email" onChange={(e) => ceremony.submitPrompt(e.target.value).catch(setError)} />
										</label>
									</form>
								),
								password: (ceremony) => (
									<form>
										<label>
											Password
											<input type="password" onChange={(e) => ceremony.submitPrompt(e.target.value).catch(setError)} />
										</label>
									</form>
								),
								otp: (ceremony) => (
									<form>
										<a role="send" onClick={(e) => (e.preventDefault(), ceremony.sendValidationCode("en").catch(setError))}>Send</a>
										<label>
											OTP
											<input type="text" onChange={(e) => ceremony.submitValidationCode(e.target.value).catch(setError)} />
										</label>
									</form>
								),
							}}
						/>
					</main>
					<footer>
						<a role="back" onClick={(e) => (e.preventDefault(), ceremony.prev().catch(setError))}>Back</a>
						<a role="reset" onClick={(e) => (e.preventDefault(), ceremony.reset().catch(setError))}>Reset</a>
					</footer>
				</>
			)}
		</Authentication>
	);
}
