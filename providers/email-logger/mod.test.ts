import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { LogLevel, setGlobalLogHandler } from "../../logger.ts";
import { Message } from "../../providers/email.ts";
import { EmailLoggerProvider } from "./mod.ts";

Deno.test("send", async () => {
	const messages: { ns: string; lvl: string; message: Message }[] = [];
	setGlobalLogHandler((ns, lvl, msg) => {
		messages.push({ ns, lvl, message: JSON.parse(msg)! });
	});
	const mailer = new EmailLoggerProvider(LogLevel.WARN);
	await mailer.send({ to: "to@acme.local", subject: "A subject", text: "A message" });
	assertEquals(messages.length, 1);
	assertEquals(messages[0].lvl, LogLevel.WARN);
	assertEquals(messages[0].message.subject, "A subject");
	setGlobalLogHandler(() => {});
});
