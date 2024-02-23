import { assertEquals, assertObjectMatch } from "../deps.test.ts";
import type { NotificationProvider } from "./notification.ts";
import type { Notification } from "../lib/notification/types.ts";

export default async function testNotificationProvider(
	np: NotificationProvider,
	destination: unknown,
	t: Deno.TestContext,
	getLastNotification: () => Promise<Notification>,
): Promise<void> {
	await t.step("send", async () => {
		const notice1: Notification = {
			subject: "A subject",
			content: {
				"text/x-otp-code": "A message",
			},
		};
		await np.send(destination, notice1);
		const notice1a = await getLastNotification();
		assertObjectMatch(notice1a, notice1);
	});
}
