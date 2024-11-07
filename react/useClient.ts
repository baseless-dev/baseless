// @deno-types="npm:@types/react@18"
import { type Context, createContext, useContext } from "react";
import type { Client, TypedClient } from "@baseless/client";

const ClientContext: Context<Client> = createContext<Client>(undefined!);

export const ClientProvider = ClientContext.Provider;

// deno-lint-ignore no-empty-interface
export interface TClient {}

// deno-fmt-ignore
// @ts-expect-error TClient is suposed to be defined by augmentation
export function useClient(): TypedClient<TClient['rpcs'], TClient['events'], TClient['documents'], TClient['collections'], TClient['files'], TClient['folders']> {
	const client = useContext(ClientContext);
	if (!client) {
		throw new Error("useClient must be used within a ClientProvider");
	}
	return client as never;
}

export default useClient;
