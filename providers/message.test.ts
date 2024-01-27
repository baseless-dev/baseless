import { assertEquals } from "../deps.test.ts";
import type { MessageProvider } from "./message.ts";
import { autoid } from "../lib/autoid.ts";
import type { Message } from "../lib/message.ts";

export default async function testMessageProvider(
	mp: MessageProvider,
	t: Deno.TestContext,
	getLastMessage: () => Promise<Message>,
): Promise<void> {
	await t.step("send", async () => {
		const msg1: Message = {
			recipient: autoid(),
			subject: "A subject",
			text: "A message",
		};
		await mp.send(msg1);
		const msg2 = await getLastMessage();
		assertEquals(msg1, msg2);
	});
}
