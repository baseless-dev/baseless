// @deno-types="npm:@types/react@19"
import { useEffect, useState } from "react";
import { useClient } from "./useClient.ts";
import type { Client } from "@baseless/client";
import type { AuthenticationTokensObject } from "@baseless/core/authentication-tokens";

export function useTokens(client: Client = useClient()): AuthenticationTokensObject | undefined {
	const [identity, setIdentity] = useState<AuthenticationTokensObject | undefined>(client.credentials.tokens ?? undefined);

	useEffect(() => {
		const listener = client.credentials.onChange((tokens) => setIdentity(tokens ?? undefined));
		return () => listener[Symbol.dispose]();
	}, [client, setIdentity]);

	return identity;
}
