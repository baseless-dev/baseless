import { ChannelReference } from "https://baseless.dev/x/shared/message.ts";

export class Participant<Metadata = Record<never, never>> {
	public constructor(
		/**
		 * User ID
		 */
		public readonly id: string,
		/**
		 * Metadata of this participant
		 */
		public readonly metadata: Metadata,
		/**
		 * ISocket of the participant
		 */
		public readonly webSocket: WebSocket,
	) {}
}

export interface IChannel<ChannelMetadata = Record<never, never>, ParticipantMetadata = Record<never, never>> {
	/**
	 * Channel reference
	 */
	ref: ChannelReference;

	/**
	 * Channel metadata
	 */
	metadata: ChannelMetadata;

	/**
	 * List of participants
	 */
	participants: Participant<ParticipantMetadata>[];

	/**
	 * Broadcast a message to all participant of this channel
	 */
	broadcast(message: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void>;

	/**
	 * Send a message to a participant
	 */
	whisper(participantId: string, message: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void>;
}

export interface IMessageProvider {
	/**
	 * Retrieve a Channel by it's reference
	 */
	channel<ChannelMetadata, ParticipantMetadata>(
		reference: ChannelReference,
		metadata: ChannelMetadata,
	): Promise<IChannel<ChannelMetadata, ParticipantMetadata>>;
}
