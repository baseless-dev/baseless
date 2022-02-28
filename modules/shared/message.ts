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

export class Participant<Metadata = Record<never, never>> {
	public constructor(
		/**
		 * User ID
		 */
		public readonly userId: string,
		/**
		 * Metadata of this participant
		 */
		public readonly metadata: Metadata,
	) {}
}

/**
 * Channel not found error
 */
export class ChannelNotFoundError extends Error {
	public name = "ChannelNotFoundError";
}
