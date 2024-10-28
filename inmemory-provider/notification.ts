import type { NotificationChannelProvider } from "@baseless/server/notification-channel-provider";
import type { IdentityChannel } from "@baseless/core/identity";
import type { Notification } from "@baseless/core/notification";
import { createLogger, LogLevel, LogLevelMethod } from "@baseless/core/logger";

export class MemoryNotificationProvider implements NotificationChannelProvider {
	notifications: Notification[] = [];

	verify(_identityChannel: IdentityChannel): Promise<boolean> {
		return Promise.resolve(true);
	}

	send(_identityChannel: IdentityChannel, notification: Notification): Promise<boolean> {
		this.notifications.push(notification);
		return Promise.resolve(true);
	}
}

export class ConsoleNotificationProvider implements NotificationChannelProvider {
	#logger = createLogger("ConsoleNotificationProvider");
	#level: LogLevel;

	constructor(level = LogLevel.DEBUG) {
		this.#level = level;
	}

	verify(_identityChannel: IdentityChannel): Promise<boolean> {
		return Promise.resolve(true);
	}

	send(_identityChannel: IdentityChannel, notification: Notification): Promise<boolean> {
		this.#logger[LogLevelMethod[this.#level]](`${notification.subject}\n${JSON.stringify(notification.content, null, "  ")}`);
		return Promise.resolve(true);
	}
}
