import {
	createLogger,
	type Logger,
	LogLevel,
	LogLevelMethod,
} from "../../lib/logger.ts";
import type { NotificationProvider } from "../notification.ts";
import type { Notification } from "../../lib/notification/types.ts";

/**
 * A mail provider that log every notification
 */
export class LoggerNotificationProvider implements NotificationProvider {
	#logger = createLogger("notification-logger");

	#logMethod: keyof Logger;

	transport = "logger";

	public constructor(logLevel = LogLevel.INFO) {
		this.#logMethod = LogLevelMethod[logLevel];
	}

	// deno-lint-ignore require-await
	public async send(
		destination: unknown,
		notification: Notification,
	): Promise<void> {
		this.#logger[this.#logMethod](
			JSON.stringify({ ...notification, destination }),
		);
	}
}
