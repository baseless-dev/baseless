import { Message } from "https://baseless.dev/x/shared/mail.ts";
// import { User } from "https://baseless.dev/x/shared/auth.ts";
import { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
import { Context } from "./context.ts";

export type MessageTemplate = Omit<Message, "to">;

export type LocalizedMessageHandler<Data> = (
	context: Context,
	data: Data,
) => MessageTemplate;

export type LocalizedMessageTemplate<Data> = Record<
	string,
	LocalizedMessageHandler<Data>
>;

/**
 * Client
 */
export class Client {
	public constructor(
		/**
		 * Client id
		 */
		public id: string,
		/**
		 * Principal
		 */
		public principal: string,
		/**
		 * Allowed urls
		 */
		public url: string[],
		/**
		 * Keys algorithm
		 */
		public algKey: string,
		/**
		 * Public key
		 */
		public publicKey: KeyLike,
		/**
		 * Private key
		 */
		public privateKey: KeyLike,
		/**
		 * Client templates
		 */
		public templates?: {
			validation: LocalizedMessageTemplate<{ code: string; email: string }>;
			passwordReset: LocalizedMessageTemplate<{ code: string; email: string }>;
		},
	) {}
}

/**
 * Client Provider
 */
export interface IClientProvider {
	/**
	 * Retrieve a Client by it's id
	 */
	getClientById(id: string): Promise<Client>;
}

/**
 * Client not found error
 */
export class ClientNotFoundError extends Error {
	public name = "ClientNotFoundError";
	public constructor(id: string) {
		super(`Client '${id}' not found.`);
	}
}
