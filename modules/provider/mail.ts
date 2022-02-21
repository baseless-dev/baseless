import type { Message } from "https://baseless.dev/x/shared/mail.ts";
import { NoopProviderError } from "./mod.ts";

/**
 * Mail Provider
 */
export interface IMailProvider {
	/**
	 * Send a message
	 */
	send(message: Message): Promise<void>;
}

/**
 * Noop Mail Provider
 */
export class NoopMailProvider implements IMailProvider {
	/**
	 * Send a message
	 */
	public send(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}
}
