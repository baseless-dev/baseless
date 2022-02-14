import { functions } from "https://baseless.dev/x/server/mod.ts";

// deno-lint-ignore require-await
functions.http("hello-world").onCall(async () => {
	return new Response("Hello World!");
});
