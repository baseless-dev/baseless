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
 * Channel not found error
 */
export class ChannelNotFoundError extends Error {
	public name = "ChannelNotFoundError";
}
