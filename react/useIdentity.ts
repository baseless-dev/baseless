// @deno-types="npm:@types/react"
import { useEffect, useState } from "react";
import { useClient } from "./useClient.ts";
import type { Client } from "@baseless/client";
import type { Identity } from "@baseless/core";

export function useIdentity({ client = useClient() }: { client?: Client }): Identity | undefined {
	const [identity, setIdentity] = useState<Identity | undefined>(client.currentIdentity);

	useEffect(() => {
		const listener = client.onAuthenticationStateChange((identity) => setIdentity(identity));
		return () => listener[Symbol.dispose]();
	}, [client, setIdentity]);

	return identity;
}
