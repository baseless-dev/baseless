// @deno-types="npm:@types/react@19"
import { type Context, createContext, useContext } from "react";
import type { Client } from "@baseless/client";

const ClientContext: Context<Client> = createContext<Client>(undefined!);

/** React context provider that makes a {@link Client} available to all child components. */
export const ClientProvider = ClientContext.Provider;

/**
 * Returns the nearest {@link Client} from context.
 * Must be rendered inside a {@link ClientProvider}.
 * @returns The current {@link Client} instance.
 * @throws If called outside a `ClientProvider`.
 */
export function useClient(): Client {
	const client = useContext(ClientContext);
	if (!client) {
		throw new Error("useClient must be used within a ClientProvider");
	}
	return client as never;
}

export default useClient;
