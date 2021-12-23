import { IContext } from "./context.ts";

/**
 * Functions descriptor
 */
export type FunctionsDescriptor = {
	readonly https: ReadonlyArray<FunctionsHttpDescriptor>;
};

/**
 * Functions builder
 */
export class FunctionsBuilder {
	private httpFunctions = new Set<FunctionsHttpBuilder>();

	public build(): FunctionsDescriptor {
		return {
			https: Array.from(this.httpFunctions).map((b) => b.build()),
		};
	}

	/**
	 * Create a Http function descriptor
	 */
	public http(path: string) {
		const builder = new FunctionsHttpBuilder(path);
		this.httpFunctions.add(builder);
		return builder;
	}
}

/**
 * Functions Http handler
 */
export type FunctionsHttpHandler = (
	request: Request,
	ctx: IContext,
) => Promise<Response>;

/**
 * Functions Http descriptor
 */
export type FunctionsHttpDescriptor = {
	readonly path: string;
	readonly onCall?: FunctionsHttpHandler;
};

/**
 * Functions Http builder
 */
export class FunctionsHttpBuilder {
	private onCallHandler?: FunctionsHttpHandler;

	/**
	 * Construct a new Functions Http builder
	 */
	public constructor(private path: string) {}

	/**
	 * Build a functions http descriptor
	 */
	public build(): FunctionsHttpDescriptor {
		return {
			path: this.path,
			onCall: this.onCallHandler,
		};
	}

	/**
	 * Set the update handler
	 */
	public onCall(handler: FunctionsHttpHandler) {
		this.onCallHandler = handler;
		return this;
	}
}
