import { ChannelReference } from "https://baseless.dev/x/shared/message.ts";
import type { AuthIdentifier } from "https://baseless.dev/x/shared/auth.ts";
import { Context } from "./context.ts";
import { NoopProviderError } from "./mod.ts";

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

export interface IChannel<ChannelMetadata = Record<never, never>> {
	/**
	 * Channel reference
	 */
	readonly ref: ChannelReference;

	// /**
	//  * Channel metadata
	//  */
	// metadata(): Promise<ChannelMetadata>;

	// /**
	//  * List of participants
	//  */
	// participants(): Promise<ISession<ParticipantMetadata>[]>;

	// /**
	//  * Broadcast a message to all participant of this channel
	//  */
	// broadcast(message: Message): Promise<void>;

	// /**
	//  * Send a message to a participant
	//  */
	// whisper(participantId: string, message: Message): Promise<void>;
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
		return Promise.reject(new NoopProviderError());
	}

	get() {
		return Promise.reject(new NoopProviderError());
	}

	delete() {
		return Promise.reject(new NoopProviderError());
	}
}

export interface IMessageProvider {
	/**
	 * Session has connect
	 */
	connect(context: Context, session: ISession): Promise<void>;

	/**
	 * Session has disconnect
	 */
	disconnect(context: Context, session: ISession): Promise<void>;

	/**
	 * Session joins channel
	 */
	join(context: Context, session: ISession, ref: ChannelReference): Promise<void>;

	/**
	 * Session leaves channel
	 */
	leave(context: Context, session: ISession, ref: ChannelReference): Promise<void>;

	/**
	 * Session send message to channel
	 */
	send(context: Context, session: ISession, ref: ChannelReference, message: string): Promise<void>;
}

export class NoopMessageProvider implements IMessageProvider {
	connect() {
		return Promise.reject(new NoopProviderError());
	}

	disconnect() {
		return Promise.reject(new NoopProviderError());
	}

	join() {
		return Promise.reject(new NoopProviderError());
	}

	leave() {
		return Promise.reject(new NoopProviderError());
	}

	send() {
		return Promise.reject(new NoopProviderError());
	}
}
