import { assertEquals } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { setGlobalLogger } from "https://baseless.dev/x/baseless/logger.ts";
import { Message } from "https://baseless.dev/x/baseless/provider/mail.ts";
import { MailLoggerProvider } from "./mod.ts";

Deno.test("send", async () => {
	const messages: Message[] = [];
	setGlobalLogger((_ns, _lvl, msg) => {
		messages.push(JSON.parse(msg)!);
	});
	const mailer = new MailLoggerProvider();
	await mailer.send({ to: "to@acme.local", subject: "A subject", text: "A message" });
	assertEquals(messages.length, 1);
	assertEquals(messages[0].subject, "A subject");
	setGlobalLogger(() => {});
});
