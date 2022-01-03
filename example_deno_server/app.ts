import {
	auth,
	clients,
	functions,
} from "https://baseless.dev/x/baseless/worker.ts";

auth.allowAnonymousUser(true).allowSignMethodPassword(true);

const client = clients.register(
	"Hello World",
	["http://localhost:8787/", "https://hello-world.baseless.dev/"],
	"hello-world",
);

client.setTemplateValidation("en", {
	subject: "Email validation",
	link: "http://localhost:8787/auth/email-validation",
	text: `Hello,

Follow this link to verify your email address.

%LINK%

If you didn’t ask to verify this address, you can ignore this email.

Thanks,

Your %APP_NAME% team`,
});
client.setTemplatePasswordReset("en", {
	subject: "Password reset",
	link: "http://localhost:8787/auth/password-reset",
	text: `Hello,

	Follow this link to reset your %APP_NAME% password for your account.
	
	%LINK%
	
	If you didn’t ask to reset your password, you can ignore this email.
	
	Thanks,
	
	Your %APP_NAME% team`,
});

// deno-lint-ignore require-await
functions.http("hello-world").onCall(async () => {
	return new Response("Hello World!");
});
