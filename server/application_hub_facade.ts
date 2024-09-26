// deno-lint-ignore-file no-explicit-any
import { Application } from "./application.ts";
import { Context, TypedContext } from "./types.ts";
import { HubProvider } from "./hub_provider.ts";
import { ID } from "@baseless/core/id";

export class ApplicationHubServiceFacade extends HubProvider {
	#application: Application;
	#context: TypedContext<any, any, any, any>;
	#provider: HubProvider;

	constructor(
		application: Application,
		context: TypedContext<any, any, any, any>,
		provider: HubProvider,
	) {
		super();
		this.#application = application;
		this.#context = context;
		this.#provider = provider;
	}

	connectHub(hubId: ID<"hub_">): Promise<void> {
		return this.#application.connectHub({
			context: this.#context,
			hubId,
		});
	}

	disconnectHub(hubId: ID<"hub_">): Promise<void> {
		return this.#application.disconnectHub({
			context: this.#context,
			hubId,
		});
	}

	sendToHub(hubId: ID<"hub_">, data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
		return this.#provider.sendToHub(hubId, data);
	}

	transfer(request: Request, context: Context): Promise<Response> {
		return this.#provider.transfer(request, context);
	}
}
