// @deno-types="npm:@types/react@19"
import { type Context, createContext, useContext } from "react";
import type { Client } from "@baseless/client";

const ClientContext: Context<Client> = createContext<Client>(undefined!);

export const ClientProvider = ClientContext.Provider;

export function useClient(): Client {
	const client = useContext(ClientContext);
	if (!client) {
		throw new Error("useClient must be used within a ClientProvider");
	}
	return client as never;
}

export default useClient;
