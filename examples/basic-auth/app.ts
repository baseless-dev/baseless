import { auth, functions } from "https://baseless.dev/x/server/mod.ts";

auth.allowAnonymousUser(true).allowSignMethodPassword(true);

// deno-lint-ignore require-await
functions.http("hello-world").onCall(async () => {
	return new Response("Hello World2!");
});
