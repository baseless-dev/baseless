import { ChannelReference } from "https://baseless.dev/x/shared/message.ts";
import type { AuthIdentifier } from "https://baseless.dev/x/shared/auth.ts";
import { Context } from "./context.ts";
import { NoopError } from "./mod.ts";

export interface IMessageHub {
	upgrade(request: Request, context: Context): Promise<Response>;
}

export class NoopMessageHub implements IMessageHub {
	upgrade() {
		return Promise.reject(new NoopError());
	}
}

export type Message = string | ArrayBufferLike | Blob | ArrayBufferView;
export type MessageSender = (message: Message) => void;

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

export interface IChannelProvider {
	/**
	 * Create a Channel
	 */
	create<Metadata>(
		reference: ChannelReference,
		metadata: Metadata,
	): Promise<IChannel<Metadata>>;

	/**
	 * Retrieve a Channel by it's reference
	 */
	get<Metadata>(
		reference: ChannelReference,
		metadata: Metadata,
	): Promise<IChannel<Metadata>>;

	/**
	 * Delete a Channel by it's reference
	 */
	delete(reference: ChannelReference): Promise<void>;
}

export class NoopChannelProvider implements IChannelProvider {
	create() {
		return Promise.reject(new NoopError());
	}

	get() {
		return Promise.reject(new NoopError());
	}

	delete() {
		return Promise.reject(new NoopError());
	}
}
