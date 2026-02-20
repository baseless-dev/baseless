import { assertRejects, assertThrows } from "@std/assert";
import * as z from "./schema.ts";
import { id } from "./id.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

Deno.test("schema", async (ctx) => {
	await ctx.step("ID", () => {
		const _a = z.id("usr_").parse(id("usr_"));
		assertThrows(() => z.id("usr_").parse(id("prd_")));
	});

	await ctx.step("Reference", () => {
		const _a = z.reference("post/:postId").parse("post/1234");
		assertThrows(() => z.reference("post/:postId").parse("file/1234"));
	});

	await ctx.step("FormData", () => {
		const f = new FormData();
		f.append("foo", "bar");
		const _a = z.formData({ foo: z.string() }).parse(f);
		assertThrows(() => z.formData({ bar: z.string() }).parse(f));
	});

	await ctx.step("ReadableStream", () => {
		const _a = z.readableStream().parse(new ReadableStream());
		assertThrows(() => z.readableStream().parse(new Object()));
	});

	await ctx.step("Request", async () => {
		const _a = z.jsonRequest({ foo: z.literal("bar") }).parse(await Request.json({ foo: "bar" }));
		assertRejects(async () => z.request({ method: "POST" }).parse(await Request.from("http://local", { method: "POST", body: "allo" })));
	});

	await ctx.step("Response", () => {
		const _a = z.jsonResponse({ foo: z.literal("bar") }).parse(Response.json({ foo: "bar" }));
		const _b = z.union([
			z.jsonResponse(),
			z.response({
				status: 200,
				headers: { "content-type": z.literal("text/html") },
				body: z.string(),
			}),
		]);
		const _c = new Response("undefined", {
			status: 200,
			headers: { "content-type": "text/html" },
		});
		const _d = Response.json({});
		const _t1: z.infer<typeof _b> = _c;
		const _t2: z.infer<typeof _b> = _d;
		const _t3: () => z.infer<typeof _b> = () => {
			return 1 ? _c : _d;
		};
		assertThrows(() => z.jsonResponse().parse(Response.error()));
	});
});
