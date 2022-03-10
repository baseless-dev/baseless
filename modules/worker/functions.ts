import { Context } from "https://baseless.dev/x/provider/context.ts";

/**
 * Functions descriptor
 */
export class FunctionsDescriptor {
	public constructor(
		public readonly https: ReadonlyArray<FunctionsHttpDescriptor>,
	) {}

	public getHttpDescriptor(path: string): FunctionsHttpDescriptor | undefined {
		for (const http of this.https) {
			if (http.path === path) {
				return http;
			}
		}
	}
}

/**
 * Functions builder
 */
export class FunctionsBuilder {
	private httpFunctions = new Set<FunctionsHttpBuilder>();

	public build(): FunctionsDescriptor {
		return new FunctionsDescriptor(
			Array.from(this.httpFunctions).map((b) => b.build()),
		);
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
	context: Context,
) => Promise<Response>;

/**
 * Functions Http descriptor
 */
export class FunctionsHttpDescriptor {
	public constructor(
		public readonly path: string,
		private readonly onCallHandler?: FunctionsHttpHandler,
	) {}

	public onCall(request: Request, context: Context): Promise<Response> {
		return this.onCallHandler?.(request, context) ?? Promise.resolve(new Response(null, { status: 500 }));
	}
}

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
		return new FunctionsHttpDescriptor(
			this.path,
			this.onCallHandler,
		);
	}

	/**
	 * Set the update handler
	 */
	public onCall(handler: FunctionsHttpHandler) {
		this.onCallHandler = handler;
		return this;
	}
}

export const functions = new FunctionsBuilder();
