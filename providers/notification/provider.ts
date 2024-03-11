import type { Notification } from "../../lib/notification/types.ts";

export interface NotificationProvider {
	transport: string;

	/**
	 * Send a notification
	 * @param destination The destination of the notification
	 * @param notification The {@link Notification} to be sent
	 */
	send(
		destination: unknown,
		notification: Notification,
	): Promise<void>;
}
