import { auth, clients, functions } from "https://baseless.dev/x/baseless/worker.ts";

auth.allowAnonymousUser(true).allowSignMethodPassword(true);

clients.register(
	"Hello World",
	"http://localhost:8080/",
	"hello-world",
	"secret",
);

// deno-lint-ignore require-await
functions.http("hello-world").onCall(async () => {
	return new Response("Hello World!");
});
