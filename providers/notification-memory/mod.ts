import { createLogger } from "../../lib/logger.ts";
import type { NotificationProvider } from "../notification.ts";
import type { Notification } from "../../lib/notification/types.ts";

/**
 * A mail provider that log every notification
 */
export class MemoryNotificationProvider implements NotificationProvider {
	#logger = createLogger("notification-memory");

	transport = "memory";

	notifications: Array<Notification & { destination: unknown }> = [];

	// deno-lint-ignore require-await
	public async send(
		destination: unknown,
		notification: Notification,
	): Promise<void> {
		this.notifications.push({ ...notification, destination });
	}
}
