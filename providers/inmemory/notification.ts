import { type IdentityChannel, type Notification, NotificationChannelProvider } from "@baseless/server";
import { createLogger, LogLevel, LogLevelMethod } from "@baseless/core/logger";

/**
 * In-memory implementation of {@link NotificationChannelProvider}.
 *
 * Accumulates sent {@link Notification} objects in the public `notifications`
 * array, making it easy to assert delivery in unit tests.
 */
export class MemoryNotificationProvider extends NotificationChannelProvider {
	notifications: Notification[] = [];

	send(_identityChannel: IdentityChannel, notification: Notification): Promise<boolean> {
		this.notifications.push(notification);
		return Promise.resolve(true);
	}
}

/**
 * Debug {@link NotificationChannelProvider} that logs notifications to the
 * console via the built-in `@baseless/core` logger.
 *
 * The log level can be configured at construction time; it defaults to
 * `LogLevel.DEBUG`.
 */
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
