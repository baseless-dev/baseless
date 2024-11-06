// @deno-types="npm:@types/react@18"
import { useEffect, useState } from "react";
import { useClient } from "./useClient.ts";
import type { Identity } from "@baseless/core/identity";
import type { Client } from "@baseless/client";

export function useIdentity(client: Client = useClient()): Identity | undefined {
	const [identity, setIdentity] = useState<Identity | undefined>(client.currentIdentity);

	useEffect(() => {
		const listener = client.onAuthenticationStateChange((identity) => setIdentity(identity));
		return () => listener[Symbol.dispose]();
	}, [client, setIdentity]);

	return identity;
}
