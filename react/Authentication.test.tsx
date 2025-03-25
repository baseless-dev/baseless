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
import createMemoryClientServer from "../client/internal.test.ts";
import { collection, onRequest, onTopicMessage, Permission, topic, Type } from "@baseless/server";
import { Authentication, AuthenticationPrompt } from "./Authentication.ts";
import { ClientProvider } from "./useClient.ts";
import { Client } from "@baseless/client";

Deno.test("Authentication", async (ctx) => {
	const pings: string[] = [];
	const app = {
		hello: onRequest(
			"hello",
			Type.String(),
			Type.String(),
			({ input, auth }) => `Hello ${input} (from ${auth?.identityId ?? "anonymous"})`,
			() => Permission.All,
		),
		posts: collection("post", Type.String(), Type.String(), () => Permission.All),
		ping: topic("ping", Type.String(), () => Permission.All),
		onPing: onTopicMessage("ping", ({ message }) => {
			pings.push(message.data);
		}),
	};

	await ctx.step("login", async () => {
		await using mock = await createMemoryClientServer(app);
		using screen = render(<LoginPage client={mock.client} />);

		const email1 = await screen.findByLabelText("Email");
		await fireEvent.change(email1, { target: { value: "bar@test.local" } });

		await screen.findByText("Clear error");

		const email2 = await screen.findByLabelText("Email");
		await fireEvent.change(email2, { target: { value: "foo@test.local" } });

		const password = await screen.findByLabelText("Password");
		await fireEvent.change(password, { target: { value: "lepassword" } });

		await waitFor(() => assertEquals(mock.client.identity?.id, mock.identity.id));
	});

	await ctx.step("register", async () => {
		await using mock = await createMemoryClientServer(app);
		using screen = render(<RegistrationPage client={mock.client} />);

		const email = await screen.findByLabelText("Email");
		await fireEvent.change(email, { target: { value: "foo@test.local" } });

		const send = await screen.findByRole("send");
		await fireEvent.click(send);

		const code = await waitFor(() => {
			const code = mock.provider.notification.notifications[0].content["text/x-code"];
			assert(code);
			return code;
		});

		const otp = await screen.findByLabelText("OTP");
		await fireEvent.change(otp, { target: { value: code } });

		const password = await screen.findByLabelText("Password");
		await fireEvent.change(password, { target: { value: "lepassword" } });

		await waitFor(() => assert(mock.client.identity?.id));
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
	return (
		<Authentication flow={props.flow}>
			{(controller) => (
				<>
					<main>
						{controller.error && (
							<div>
								<button type="button" onClick={(e) => (e.preventDefault(), controller.clearError())}>Clear error</button>
								<p>{controller.error.message}</p>
							</div>
						)}
						<AuthenticationPrompt
							choice={(controller, components) => (
								<ul>
									{components.map((component) => (
										<li>
											<button type="button" onClick={(e) => (e.preventDefault(), controller.select(component))}>{component.id}</button>
										</li>
									))}
								</ul>
							)}
							prompts={{
								email: (controller) => (
									<form>
										<label>
											Email
											<input type="email" onChange={(e) => controller.submit(e.target.value)} />
										</label>
									</form>
								),
								password: (controller) => (
									<form>
										<label>
											Password
											<input type="password" onChange={(e) => controller.submit(e.target.value)} />
										</label>
									</form>
								),
								otp: (controller) => (
									<form>
										<a role="send" onClick={(e) => (e.preventDefault(), controller.send("en"))}>Send</a>
										<label>
											OTP
											<input type="text" onChange={(e) => controller.submit(e.target.value)} />
										</label>
									</form>
								),
							}}
						/>
					</main>
					<footer>
						<a role="back" onClick={(e) => (e.preventDefault(), controller.back())}>Back</a>
						<a role="reset" onClick={(e) => (e.preventDefault(), controller.reset())}>Reset</a>
					</footer>
				</>
			)}
		</Authentication>
	);
}
