import type { ChannelMessage } from "https://baseless.dev/x/shared/message.ts";
import { ChannelReference } from "https://baseless.dev/x/shared/message.ts";
import type { AuthIdentifier } from "https://baseless.dev/x/shared/auth.ts";
import type { Context } from "./context.ts";
import { NoopError } from "./mod.ts";

/**
 * Message hub interface
 *
 * Message hub keeps track of the WebSocket connection and handle the channel protocol
 */
export interface IMessageHub {
	/**
	 * Transfert request to this message hub
	 */
	transfert(request: Request, context: Context): Promise<Response>;
}

/**
 * Noop Message Hub
 *
 * @internal
 */
export class NoopMessageHub implements IMessageHub {
	transfert() {
		return Promise.reject(new NoopError());
	}
}

export type MessageSender = (message: ChannelMessage) => void;

/**
 * Session
 */
export interface ISession {
	/**
	 * Id of this session
	 */
	readonly id: string;

	/**
	 * User ID of this session
	 */
	readonly userId?: AuthIdentifier;

	/**
	 * WebSocket of this session
	 */
	readonly socket: WebSocket;
}

/**
 * Participant of a specific channel
 */
export interface IParticipant<Metadata = Record<never, never>> {
	/**
	 * Session information
	 */
	readonly session: ISession;

	/**
	 * Metadata of this participant
	 */
	readonly metadata: Metadata;
}

/**
 * Channel
 */
export interface IChannel<Channel = Record<never, never>, Participant = Record<never, never>> {
	/**
	 * Channel reference
	 */
	readonly ref: ChannelReference;

	/**
	 * Channel metadata
	 */
	readonly metadata: Channel;

	/**
	 * List of participants
	 */
	readonly participants: IParticipant<Participant>[];
}

/**
 * Message provider
 */
export interface IMessageProvider {
	/**
	 * Broadcast a message to the channel
	 */
	broadcast(context: Context, reference: ChannelReference, message: ChannelMessage): Promise<void>;
}

/**
 * Noop message provider
 *
 * @internal
 */
export class NoopMessageProvider implements IMessageProvider {
	broadcast() {
		return Promise.reject(new NoopError());
	}
}
