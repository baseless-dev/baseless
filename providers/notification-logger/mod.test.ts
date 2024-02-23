import { setGlobalLogHandler } from "../../lib/logger.ts";
import testNotificationProvider from "../notification.test.ts";
import { LoggerNotificationProvider } from "./mod.ts";
import type { Notification } from "../../lib/notification/types.ts";

Deno.test("LoggerNotificationProvider", async (t) => {
	const np = new LoggerNotificationProvider();
	const notifications: {
		ns: string;
		lvl: string;
		notification: Notification;
	}[] = [];
	setGlobalLogHandler((ns, lvl, msg) => {
		notifications.push({ ns, lvl, notification: JSON.parse(msg)! });
	});
	// deno-lint-ignore require-await
	await testNotificationProvider(np, "", t, async () => {
		const msg = notifications.pop();
		if (msg) {
			return Promise.resolve(msg.notification);
		}
		return Promise.reject(new Error("No notification"));
	});
	setGlobalLogHandler(() => {});
});
