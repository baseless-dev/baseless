import { useClient } from "./useClient.ts";
import { useTokens } from "./useTokens.ts";
import type { Identity } from "@baseless/core/identity";
import type { Client } from "@baseless/client";

/**
 * Returns the {@link Identity} for the currently authenticated user, or
 * `undefined` when no user is signed in.
 * @param client The {@link Client} to read from (defaults to the nearest
 * context client).
 * @returns The active {@link Identity}, or `undefined`.
 */
export function useIdentity(client: Client = useClient()): Identity | undefined {
	const tokens = useTokens(client);

	return tokens?.identity;
}
