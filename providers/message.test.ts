import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import type { MessageProvider } from "./message.ts";
import type { Message } from "../common/message/message.ts";
import { type AutoId, autoid } from "../common/system/autoid.ts";

export default async function testMessageProvider(
	mp: MessageProvider,
	t: Deno.TestContext,
	getLastMessage: () => Promise<Message>,
): Promise<void> {
	await t.step("send", async () => {
		const msg1: Message<AutoId> = {
			recipient: autoid(),
			subject: "A subject",
			text: "A message",
		};
		await mp.send(msg1);
		const msg2 = await getLastMessage();
		assertEquals(msg1, msg2);
	});
}
