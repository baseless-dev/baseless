import type { ID } from "@baseless/core/id";
import type { Context } from "./types.ts";

export abstract class HubProvider {
	abstract sendToHub(hubId: ID<"hub_">, data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void>;
	abstract transfer(request: Request, context: Context): Promise<Response>;
}
