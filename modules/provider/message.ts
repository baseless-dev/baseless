import { ChannelReference, Participant } from "https://baseless.dev/x/shared/message.ts";

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
	participants: Map<string, Participant<ParticipantMetadata>>;

	/**
	 * Forward Request to this Channel
	 */
	forward(request: Request): Promise<Response>;

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
	 * Create a new Channel
	 */
	createChannel<ChannelMetadata, ParticipantMetadata>(
		reference: ChannelReference,
		metadata: ChannelMetadata,
	): Promise<IChannel<ChannelMetadata, ParticipantMetadata>>;

	/**
	 * Retrieve a Channel by it's reference
	 */
	getChannel<ChannelMetadata, ParticipantMetadata>(
		reference: ChannelReference,
	): Promise<IChannel<ChannelMetadata, ParticipantMetadata>>;
}
