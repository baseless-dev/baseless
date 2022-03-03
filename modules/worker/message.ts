import { Context } from "https://baseless.dev/x/provider/context.ts";
import { IChannel, Participant } from "https://baseless.dev/x/provider/message.ts";

function refToRegExp(ref: string) {
	return new RegExp(`^${ref.replace(/:([\w]+)/g, "(?<$1>[^/]+)")}$`);
}

/**
 * Channel permission
 */
export enum ChannelPermissions {
	None = 0,
	Join = 1,
	Send = 2,
}

/**
 * Channel permission handler
 */
export type ChannelPermissionHandler =
	| ChannelPermissions
	| ((ctx: Context, params: Record<string, string>) => Promise<ChannelPermissions>);

/**
 * Channel handler
 */
export type ChannelHandler<ChannelMetadata, ParticipantMetadata> = (
	ctx: Context,
	channel: IChannel<ChannelMetadata, ParticipantMetadata>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel participant handler
 */
export type ChannelParticipantHandler<
	ChannelMetadata,
	ParticipantMetadata,
> = (
	ctx: Context,
	channel: IChannel<ChannelMetadata, ParticipantMetadata>,
	participant: Participant<ParticipantMetadata>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel message handler
 */
export type ChannelMessageHandler<ChannelMetadata, ParticipantMetadata> = (
	ctx: Context,
	channel: IChannel<ChannelMetadata, ParticipantMetadata>,
	participant: Participant<ParticipantMetadata>,
	message: string | ArrayBufferLike | Blob | ArrayBufferView,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel descriptor
 */
export type ChannelDescriptor<ChannelMetadata, ParticipantMetadata> = {
	readonly ref: string;
	readonly matcher: RegExp;
	readonly onCreate?: ChannelHandler<ChannelMetadata, ParticipantMetadata>;
	readonly onConnect?: ChannelParticipantHandler<ChannelMetadata, ParticipantMetadata>;
	readonly onMessage?: ChannelMessageHandler<ChannelMetadata, ParticipantMetadata>;
	readonly onDisconnect?: ChannelParticipantHandler<ChannelMetadata, ParticipantMetadata>;
	readonly onEmpty?: ChannelHandler<ChannelMetadata, ParticipantMetadata>;
	readonly permission?: ChannelPermissionHandler;
};

/**
 * Message descriptor
 */
export type MessageDescriptor<ChannelMetadata, ParticipantMetadata> = {
	channels: ChannelDescriptor<ChannelMetadata, ParticipantMetadata>[];
};

/**
 * Message builder
 */
export class MessageBuilder {
	private channels = new Set<ChannelBuilder>();

	/**
	 * Build the database descriptor
	 */
	public build<ChannelMetadata = Record<never, never>, ParticipantMetadata = Record<never, never>>(): MessageDescriptor<
		ChannelMetadata,
		ParticipantMetadata
	> {
		return {
			channels: Array.from(this.channels).map((b) => b.build()),
		};
	}

	/**
	 * Create a channel builder
	 */
	public channel<ChannelMetadata = Record<never, never>, ParticipantMetadata = Record<never, never>>(
		reference: string,
	): ChannelBuilder<ChannelMetadata, ParticipantMetadata> {
		const builder = new ChannelBuilder(reference);
		this.channels.add(builder);
		return builder as unknown as ChannelBuilder<ChannelMetadata, ParticipantMetadata>;
	}
}

/**
 * Channel builder
 */
export class ChannelBuilder<ChannelMetadata = Record<never, never>, ParticipantMetadata = Record<never, never>> {
	private onCreateHandler?: ChannelHandler<ChannelMetadata, ParticipantMetadata>;

	private onConnectHandler?: ChannelParticipantHandler<ChannelMetadata, ParticipantMetadata>;
	private onMessageHandler?: ChannelMessageHandler<ChannelMetadata, ParticipantMetadata>;
	private onDisconnectHandler?: ChannelParticipantHandler<ChannelMetadata, ParticipantMetadata>;
	private onEmptyHandler?: ChannelHandler<ChannelMetadata, ParticipantMetadata>;
	private permissionHandler?: ChannelPermissionHandler;

	/**
	 * Construct a new Database document builder
	 */
	public constructor(private ref: string) {}

	/**
	 * Build the channel descriptor
	 */
	public build(): ChannelDescriptor<ChannelMetadata, ParticipantMetadata> {
		return {
			ref: this.ref,
			matcher: refToRegExp(this.ref),
			onCreate: this.onCreateHandler,
			onConnect: this.onConnectHandler,
			onMessage: this.onMessageHandler,
			onDisconnect: this.onDisconnectHandler,
			onEmpty: this.onEmptyHandler,
			permission: this.permissionHandler,
		};
	}

	/**
	 * Set the create handler
	 */
	public onCreate(handler: ChannelHandler<ChannelMetadata, ParticipantMetadata>) {
		this.onCreateHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onConnect(handler: ChannelParticipantHandler<ChannelMetadata, ParticipantMetadata>) {
		this.onConnectHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onMessage(handler: ChannelMessageHandler<ChannelMetadata, ParticipantMetadata>) {
		this.onMessageHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onDisconnect(handler: ChannelParticipantHandler<ChannelMetadata, ParticipantMetadata>) {
		this.onDisconnectHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onEmpty(handler: ChannelHandler<ChannelMetadata, ParticipantMetadata>) {
		this.onEmptyHandler = handler;
		return this;
	}

	/**
	 * Set the security policy handler
	 */
	public permission(handler: ChannelPermissionHandler) {
		this.permissionHandler = handler;
		return this;
	}
}

export const messages = new MessageBuilder();
