/**
 * Channel reference
 */
export class ChannelReference {
	public segments: string[];

	public constructor(...segments: string[]) {
		this.segments = segments;
	}

	public toString() {
		return `/${this.segments.join("/")}`;
	}
}

/**
 * Create a ChannelReference
 */
export function channel(...segments: string[]) {
	if (segments.length === 1 && segments[0][0] === "/") {
		segments = segments[0].replace(/^\//, "").replace(/\/$/, "").split("/");
	}
	return new ChannelReference(...segments);
}

/**
 * Channel message payload
 */
export type ChannelMessage = string;

/**
 * Channel not found error
 */
export class ChannelNotFoundError extends Error {
	public name = "ChannelNotFoundError";
}

/**
 * Channel permission required error
 */
export class ChannelPermissionRequired extends Error {
	public name = "ChannelPermissionRequired";
}

/**
 * Message send error
 */
export class MessageSendError extends Error {
	public name = "MessageSendError";
}
