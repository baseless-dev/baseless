import { useClient } from "./useClient.ts";
import { useTokens } from "./useTokens.ts";
import type { Identity } from "@baseless/core/identity";
import type { Client } from "@baseless/client";

export function useIdentity(client: Client = useClient()): Identity | undefined {
	const tokens = useTokens(client);

	return tokens?.identity;
}
