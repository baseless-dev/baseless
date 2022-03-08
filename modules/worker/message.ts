import { Context } from "https://baseless.dev/x/provider/context.ts";
import { IChannel, ISession } from "https://baseless.dev/x/provider/message.ts";

function refToRegExp(ref: string) {
	return new RegExp(`^${ref.replace(/:([\w]+)/g, "(?<$1>[^/]+)")}$`);
}

/**
 * Message permission
 */
export enum MessagePermissions {
	None = 0,
	Connect = 1,
}

/**
 * Message permission handler
 */
export type MessagePermissionHandler =
	| MessagePermissions
	| ((ctx: Context) => Promise<MessagePermissions>);

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
export type ChannelHandler<ChannelMetadata> = (
	ctx: Context,
	channel: IChannel<ChannelMetadata>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel session handler
 */
export type ChannelSessionHandler<
	ChannelMetadata,
> = (
	ctx: Context,
	channel: IChannel<ChannelMetadata>,
	session: ISession,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel message handler
 */
export type ChannelMessageHandler<ChannelMetadata> = (
	ctx: Context,
	channel: IChannel<ChannelMetadata>,
	session: ISession,
	message: string | ArrayBufferLike | Blob | ArrayBufferView,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel descriptor
 */
export type ChannelDescriptor<ChannelMetadata> = {
	readonly ref: string;
	readonly matcher: RegExp;
	readonly onCreate?: ChannelHandler<ChannelMetadata>;
	readonly onJoin?: ChannelSessionHandler<ChannelMetadata>;
	readonly onMessage?: ChannelMessageHandler<ChannelMetadata>;
	readonly onLeave?: ChannelSessionHandler<ChannelMetadata>;
	readonly onEmpty?: ChannelHandler<ChannelMetadata>;
	readonly permission?: ChannelPermissionHandler;
};

/**
 * Message descriptor
 */
export type MessageDescriptor<ChannelMetadata = Record<never, never>> = {
	readonly channels: ChannelDescriptor<ChannelMetadata>[];
	readonly permission?: MessagePermissionHandler;
};

/**
 * Message builder
 */
export class MessageBuilder {
	private channels = new Set<ChannelBuilder>();
	private permissionHandler?: MessagePermissionHandler;

	/**
	 * Build the database descriptor
	 */
	public build<ChannelMetadata = Record<never, never>>(): MessageDescriptor<ChannelMetadata> {
		return {
			channels: Array.from(this.channels).map((b) => b.build()),
			permission: this.permissionHandler,
		};
	}

	/**
	 * Create a channel builder
	 */
	public channel<ChannelMetadata = Record<never, never>>(
		reference: string,
	): ChannelBuilder<ChannelMetadata> {
		const builder = new ChannelBuilder(reference);
		this.channels.add(builder);
		return builder as unknown as ChannelBuilder<ChannelMetadata>;
	}

	/**
	 * Set the security policy handler
	 */
	public permission(handler: MessagePermissionHandler) {
		this.permissionHandler = handler;
		return this;
	}
}

/**
 * Channel builder
 */
export class ChannelBuilder<ChannelMetadata = Record<never, never>> {
	private onCreateHandler?: ChannelHandler<ChannelMetadata>;

	private onJoinHandler?: ChannelSessionHandler<ChannelMetadata>;
	private onMessageHandler?: ChannelMessageHandler<ChannelMetadata>;
	private onLeaveHandler?: ChannelSessionHandler<ChannelMetadata>;
	private onEmptyHandler?: ChannelHandler<ChannelMetadata>;
	private permissionHandler?: ChannelPermissionHandler;

	/**
	 * Construct a new Database document builder
	 */
	public constructor(private ref: string) {}

	/**
	 * Build the channel descriptor
	 */
	public build(): ChannelDescriptor<ChannelMetadata> {
		return {
			ref: this.ref,
			matcher: refToRegExp(this.ref),
			onCreate: this.onCreateHandler,
			onJoin: this.onJoinHandler,
			onMessage: this.onMessageHandler,
			onLeave: this.onLeaveHandler,
			onEmpty: this.onEmptyHandler,
			permission: this.permissionHandler,
		};
	}

	/**
	 * Set the create handler
	 */
	public onCreate(handler: ChannelHandler<ChannelMetadata>) {
		this.onCreateHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onJoin(handler: ChannelSessionHandler<ChannelMetadata>) {
		this.onJoinHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onMessage(handler: ChannelMessageHandler<ChannelMetadata>) {
		this.onMessageHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onLeave(handler: ChannelSessionHandler<ChannelMetadata>) {
		this.onLeaveHandler = handler;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onEmpty(handler: ChannelHandler<ChannelMetadata>) {
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

export const message = new MessageBuilder();
