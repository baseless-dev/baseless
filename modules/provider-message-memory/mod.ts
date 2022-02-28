import { IChannel, IMessageProvider } from "https://baseless.dev/x/provider/message.ts";
import { ChannelNotFoundError, ChannelReference, Participant } from "https://baseless.dev/x/shared/message.ts";
import { autoid } from "https://baseless.dev/x/shared/autoid.ts";

export class MemoryChannelParticipant<ParticipantMetadata> extends Participant<ParticipantMetadata> {
	public constructor(
		public readonly webSocket: WebSocket,
		userId: string,
		metadata: ParticipantMetadata,
	) {
		super(userId, metadata);
	}
}

export class MemoryChannel<ChannelMetadata, ParticipantMetadata>
	implements IChannel<ChannelMetadata, ParticipantMetadata> {
	public constructor(
		/**
		 * Channel reference
		 */
		public readonly ref: ChannelReference,
		/**
		 * Channel metadata
		 */
		public readonly metadata: ChannelMetadata,
	) {}

	/**
	 * List of participants
	 */
	participants = new Map<string, MemoryChannelParticipant<ParticipantMetadata>>();

	/**
	 * Forward Request to this Channel
	 */
	// deno-lint-ignore require-await
	async forward(request: Request): Promise<Response> {
		if (request.headers.get("upgrade") != "websocket") {
			return new Response(null, { status: 400 });
		}
		const upgrade = Deno.upgradeWebSocket(request);

		if (!upgrade) {
			return new Response(null, { status: 400 });
		}

		const participant = new MemoryChannelParticipant(upgrade.socket, autoid(), {} as ParticipantMetadata);

		upgrade.socket.addEventListener("close", () => {
			this.participants.delete(participant.userId);
			// TODO OnDisconnected
		});
		upgrade.socket.addEventListener("message", () => {
			// TODO OnMessage
		});

		this.participants.set(participant.userId, participant);
		// TODO OnConnected

		return upgrade.response;
	}

	async broadcast(message: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
		for await (const userId of this.participants.keys()) {
			await this.whisper(userId, message);
		}
	}

	// deno-lint-ignore require-await
	async whisper(participantId: string, message: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
		const participant = this.participants.get(participantId);
		if (participant) {
			try {
				participant.webSocket.send(message);
			} catch (_err) {
				this.participants.delete(participantId);
				// TODO OnDisconnected
			}
		}
	}
}

export class MemoryMessageProvider implements IMessageProvider {
	private channels = new Map<string, MemoryChannel<Record<never, never>, Record<never, never>>>();

	/**
	 * Create a new Channel
	 */
	// deno-lint-ignore require-await
	async createChannel<ChannelMetadata, ParticipantMetadata>(
		reference: ChannelReference,
		metadata: ChannelMetadata,
	): Promise<IChannel<ChannelMetadata, ParticipantMetadata>> {
		const key = reference.toString();
		if (!this.channels.has(key)) {
			this.channels.set(key, new MemoryChannel(reference, metadata));
		}
		return this.channels.get(key)! as unknown as IChannel<ChannelMetadata, ParticipantMetadata>;
	}

	/**
	 * Retrieve a Channel by it's reference
	 */
	// deno-lint-ignore require-await
	async getChannel<ChannelMetadata, ParticipantMetadata>(
		reference: ChannelReference,
	): Promise<IChannel<ChannelMetadata, ParticipantMetadata>> {
		const key = reference.toString();
		if (!this.channels.has(key)) {
			throw new ChannelNotFoundError();
		}
		return this.channels.get(key)! as unknown as IChannel<ChannelMetadata, ParticipantMetadata>;
	}
}
