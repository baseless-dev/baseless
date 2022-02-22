import { assertEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { FunctionsBuilder } from "./functions.ts";

Deno.test("functions path", () => {
	const builder = new FunctionsBuilder();
	builder.http("/foo");
	assertEquals({
		https: [{
			path: "/foo",
			onCall: undefined,
		}],
	}, builder.build());
});

Deno.test("functions on call", () => {
	const builder = new FunctionsBuilder();
	const callback = () => Promise.resolve(new Response());
	builder.http("/foo").onCall(callback);
	assertEquals({
		https: [{
			path: "/foo",
			onCall: callback,
		}],
	}, builder.build());
});
