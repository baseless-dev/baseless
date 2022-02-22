import { assertEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { MailBuilder } from "./mail.ts";

Deno.test("mail on message sent", () => {
	const builder = new MailBuilder();
	const callback = () => Promise.resolve();
	builder.onMessageSent(callback);
	assertEquals({
		onMessageSent: callback,
	}, builder.build());
});
