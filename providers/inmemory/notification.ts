import { type IdentityChannel, type Notification, NotificationChannelProvider } from "@baseless/server";
import { createLogger, LogLevel, LogLevelMethod } from "@baseless/core/logger";

export class MemoryNotificationProvider extends NotificationChannelProvider {
	notifications: Notification[] = [];

	send(_identityChannel: IdentityChannel, notification: Notification): Promise<boolean> {
		this.notifications.push(notification);
		return Promise.resolve(true);
	}
}

export class ConsoleNotificationProvider extends NotificationChannelProvider {
	#logger = createLogger("ConsoleNotificationProvider");
	#level: LogLevel;

	constructor(level = LogLevel.DEBUG) {
		super();
		this.#level = level;
	}

	send(_identityChannel: IdentityChannel, notification: Notification): Promise<boolean> {
		this.#logger[LogLevelMethod[this.#level]](`${notification.subject}\n${JSON.stringify(notification.content, null, "  ")}`);
		return Promise.resolve(true);
	}
}
