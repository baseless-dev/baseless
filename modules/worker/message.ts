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
	| ((context: Context) => Promise<MessagePermissions>);

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
	| ((context: Context, params: Record<string, string>) => Promise<ChannelPermissions>);

/**
 * Channel handler
 */
export type ChannelHandler<ChannelMetadata> = (
	context: Context,
	channel: IChannel<ChannelMetadata>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel session handler
 */
export type ChannelSessionHandler<
	ChannelMetadata,
> = (
	context: Context,
	channel: IChannel<ChannelMetadata>,
	session: ISession,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel message handler
 */
export type ChannelMessageHandler<ChannelMetadata> = (
	context: Context,
	channel: IChannel<ChannelMetadata>,
	session: ISession,
	message: string | ArrayBufferLike | Blob | ArrayBufferView,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Channel descriptor
 */
export class ChannelDescriptor {
	public constructor(
		public readonly reference: string,
		private readonly onCreateHandler?: ChannelHandler<unknown>,
		private readonly onJoinHandler?: ChannelSessionHandler<unknown>,
		private readonly onMessageHandler?: ChannelMessageHandler<unknown>,
		private readonly onLeaveHandler?: ChannelSessionHandler<unknown>,
		private readonly onEmptyHandler?: ChannelHandler<unknown>,
		private readonly permissionHandler?: ChannelPermissionHandler,
	) {
		this.matcher = refToRegExp(reference);
	}

	private matcher: RegExp;

	public match(reference: string): undefined | Record<string, string> {
		const match = reference.match(this.matcher);
		if (match) {
			return match.groups ?? {};
		}
	}

	public onCreate(context: Context, channel: IChannel<unknown>, params: Record<string, string>): Promise<void> {
		return this.onCreateHandler?.(context, channel, params) ?? Promise.resolve();
	}

	public onJoin(
		context: Context,
		channel: IChannel<unknown>,
		session: ISession,
		params: Record<string, string>,
	): Promise<void> {
		return this.onJoinHandler?.(context, channel, session, params) ?? Promise.resolve();
	}

	public onMessage(
		context: Context,
		channel: IChannel<unknown>,
		session: ISession,
		message: string | ArrayBufferLike | Blob | ArrayBufferView,
		params: Record<string, string>,
	): Promise<void> {
		return this.onMessageHandler?.(context, channel, session, message, params) ?? Promise.resolve();
	}

	public onLeave(
		context: Context,
		channel: IChannel<unknown>,
		session: ISession,
		params: Record<string, string>,
	): Promise<void> {
		return this.onLeaveHandler?.(context, channel, session, params) ?? Promise.resolve();
	}

	public onEmpty(context: Context, channel: IChannel<unknown>, params: Record<string, string>): Promise<void> {
		return this.onEmptyHandler?.(context, channel, params) ?? Promise.resolve();
	}

	public permission(context: Context, params: Record<string, string>): Promise<ChannelPermissions> {
		if (typeof this.permissionHandler === "function") {
			return this.permissionHandler(context, params);
		}
		return Promise.resolve(this.permissionHandler ?? ChannelPermissions.None);
	}
}

/**
 * Message descriptor
 */
export class MessageDescriptor {
	public constructor(
		public readonly channels: ReadonlyArray<ChannelDescriptor>,
		private readonly permissionHandler?: MessagePermissionHandler,
	) {}

	public getChannelDescriptor(
		reference: string,
	): [ChannelDescriptor, Record<string, string>] | undefined {
		for (const channel of this.channels) {
			const groups = channel.match(reference);
			if (groups) {
				return [channel, groups];
			}
		}
	}

	public permission(context: Context): Promise<MessagePermissions> {
		if (typeof this.permissionHandler === "function") {
			return this.permissionHandler(context);
		}
		return Promise.resolve(this.permissionHandler ?? MessagePermissions.None);
	}
}

/**
 * Message builder
 */
export class MessageBuilder {
	private channels = new Set<ChannelBuilder>();
	private permissionHandler?: MessagePermissionHandler;

	/**
	 * Build the database descriptor
	 */
	public build(): MessageDescriptor {
		return new MessageDescriptor(
			Array.from(this.channels).map((b) => b.build()),
			this.permissionHandler,
		);
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
	public build(): ChannelDescriptor {
		return new ChannelDescriptor(
			this.ref,
			this.onCreateHandler,
			this.onJoinHandler,
			this.onMessageHandler,
			this.onLeaveHandler,
			this.onEmptyHandler,
			this.permissionHandler,
		);
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
