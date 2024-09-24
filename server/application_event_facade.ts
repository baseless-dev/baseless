// deno-lint-ignore-file no-explicit-any
import { Application } from "./application.ts";
import { TypedContext } from "./types.ts";
import { EventProvider } from "./event_provider.ts";
import { ID } from "../core/id.ts";

export class ApplicationEventProviderFacade extends EventProvider {
	#application: Application;
	#context: TypedContext<any, any, any, any>;
	#provider: EventProvider;

	constructor(
		application: Application,
		context: TypedContext<any, any, any, any>,
		provider: EventProvider,
	) {
		super();
		this.#application = application;
		this.#context = context;
		this.#provider = provider;
	}

	publish(key: string[], payload: unknown): Promise<void> {
		return this.#application.publishEvent({
			bypassSecurity: true,
			context: this.#context,
			event: key,
			payload,
			provider: this.#provider,
		});
	}
	subscribe(key: string[], hubId: ID<"hub_">): Promise<void> {
		return this.#application.subscribeEvent({
			bypassSecurity: true,
			context: this.#context,
			event: key,
			hubId,
			provider: this.#provider,
		});
	}
	unsubscribe(key: string[], hubId: ID<"hub_">): Promise<void> {
		return this.#application.unsubscribeEvent({
			bypassSecurity: true,
			context: this.#context,
			event: key,
			hubId,
			provider: this.#provider,
		});
	}

	unsubscribeAll(hubId: ID<"hub_">): Promise<void> {
		return this.#application.unsubscribeAllEvent({
			bypassSecurity: true,
			context: this.#context,
			hubId,
			provider: this.#provider,
		});
	}
}
