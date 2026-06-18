import { app } from "./app.ts";
import * as z from "@baseless/core/schema";
import { BadGatewayError, BadRequestError, ForbiddenError, RequestNotFoundError, ServerError } from "@baseless/core/errors";
import { Response } from "@baseless/core/response";
import { assertEquals, assertInstanceOf } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
import createMemoryServer from "./server.test.ts";

// Minimal app used throughout the dispatch tests
const echoApp = app()
	.endpoint({
		path: "echo",
		request: z.jsonRequest({ msg: z.string() }),
		response: z.jsonResponse({ msg: z.string() }),
		handler: ({ request }) => Response.json({ msg: request.body.msg }),
	})
	.endpoint({
		path: "throws-forbidden",
		request: z.jsonRequest({}),
		response: z.jsonResponse({}),
		handler: () => {
			throw new ForbiddenError();
		},
	})
	.endpoint({
		path: "throws-plain-error",
		request: z.jsonRequest({}),
		response: z.jsonResponse({}),
		handler: () => {
			throw new Error("boom");
		},
	})
	.endpoint({
		path: "bad-response",
		request: z.jsonRequest({}),
		// Response schema requires a string field `value`, but handler returns a number
		response: z.jsonResponse({ value: z.string() }),
		handler: () => Response.json({ value: 42 } as unknown as { value: string }),
	})
	.build();

Deno.test("Server dispatch", async (t) => {
	using mock = await createMemoryServer({ app: echoApp, configuration: {} });

	await t.step("unknown path returns 404", async () => {
		const [response] = await mock.server.handleRequest(
			new Request("http://test/does-not-exist", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
		);
		assertEquals(response.status, 404);
		const json = await response.json();
		assertEquals(json.error, RequestNotFoundError.name);
	});

	await t.step("request failing schema guard returns 400", async () => {
		// Send an object without the required `msg` field → BadRequestError
		const [response] = await mock.server.handleRequest(
			new Request("http://test/echo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ notMsg: 123 }),
			}),
		);
		assertEquals(response.status, 400);
		const json = await response.json();
		assertEquals(json.error, BadRequestError.name);
	});

	await t.step("handler throwing ForbiddenError returns 403", async () => {
		await assertRejects(
			() => mock.fetch("/throws-forbidden", { data: {} }),
			ForbiddenError,
		);
	});

	await t.step("handler throwing plain Error returns 500 with constructor name", async () => {
		const [response] = await mock.server.handleRequest(
			new Request("http://test/throws-plain-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
		);
		assertEquals(response.status, 500);
		const json = await response.json();
		// The error field is the constructor name of the thrown error, not "Error" mapped to a PublicError
		assertEquals(json.error, "Error");
	});

	await t.step("response failing schema guard returns 502", async () => {
		await assertRejects(
			() => mock.fetch("/bad-response", { data: {} }),
			BadGatewayError,
		);
	});

	await t.step("valid echo request returns body", async () => {
		const result = await mock.fetch("/echo", {
			data: { msg: "hello" },
			schema: z.object({ msg: z.string() }),
		});
		assertEquals(result.msg, "hello");
	});

	await t.step("Authorization: Bearer <garbage> is treated as anonymous (no error)", async () => {
		// Garbage bearer token should be swallowed silently → request succeeds normally
		const [response] = await mock.server.handleRequest(
			new Request("http://test/echo", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer not-a-real-jwt",
				},
				body: JSON.stringify({ msg: "anon" }),
			}),
		);
		assertEquals(response.status, 200);
	});

	await t.step("fetch helper re-throws ServerError for unknown error name", async () => {
		// A plain Error thrown by a handler goes through the catch block with
		// error = "Error" (constructor name). fromServerErrorData doesn't
		// recognise "Error" → returns ServerError.
		const err = await mock.fetch("/throws-plain-error", { data: {} }).catch((e) => e);
		assertInstanceOf(err, ServerError);
		assertEquals((err as ServerError).error, "Error");
	});
});
