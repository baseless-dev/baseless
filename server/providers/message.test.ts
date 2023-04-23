import {
	assertEquals,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { Message, MessageProvider } from "./message.ts";

export default async function testSessionProvider(
	mp: MessageProvider,
	t: Deno.TestContext,
	getLastMessage: () => Promise<Message>,
) {
	await t.step("send", async () => {
		const msg1: Message = {
			to: "to@acme.local",
			subject: "A subject",
			text: "A message",
		};
		await mp.send(msg1);
		const msg2 = await getLastMessage();
		assertEquals(msg1, msg2);
	});
}