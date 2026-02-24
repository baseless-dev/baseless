// @deno-types="npm:@types/react@19"
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Fragment, jsx } from "react/jsx-runtime";
import type { AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import type { AuthenticationStep } from "@baseless/core/authentication-step";
import { useClient } from "./prelude.ts";
import type { AuthenticationComponentChoiceSelection, Client, ClientAuthCeremony, ClientAuthCeremonyStore } from "@baseless/client";
import useKeyedPromise from "./useKeyedPromise.ts";
import { id } from "@baseless/core/id";

const ClientAuthCeremonyContext = createContext<ClientAuthCeremony>(null!);

/**
 * Returns the nearest {@link ClientAuthCeremony} from context.
 * Must be rendered inside an {@link Authentication} component.
 * @returns The current {@link ClientAuthCeremony}.
 * @throws If called outside an `Authentication` component.
 */
export function useAuthenticationCeremony(): ClientAuthCeremony {
	const ceremony = useContext(ClientAuthCeremonyContext);
	if (!ceremony) {
		throw new Error("useAuthenticationCeremony must be used within an Authentication");
	}
	return ceremony;
}

const createStore: (key: string) => ClientAuthCeremonyStore = (key) => {
	return {
		get: () => {
			const saved = localStorage.getItem(key);
			if (saved) {
				return JSON.parse(saved);
			}
		},
		set: (steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection>) => {
			localStorage.setItem(key, JSON.stringify(steps));
		},
		delete: () => {
			localStorage.removeItem(key);
			return;
		},
	};
};

/**
 * Initializes and manages a {@link ClientAuthCeremony}, persisting progress
 * to `localStorage` and providing it to children via React context.
 *
 * @param props.children Child nodes or render-prop receiving the ceremony.
 * @param props.client The {@link Client} to use (defaults to context client).
 * @param props.flow `"authentication"` or `"registration"`.
 * @param props.identifier Cache key prefix for `localStorage`.
 * @param props.scopes OAuth2 scopes to request.
 */
export function Authentication({
	children,
	client = useClient(),
	flow = "authentication",
	identifier = "bls",
	scopes = [],
}: {
	children: ReactNode | ((ceremony: ClientAuthCeremony) => ReactNode);
	client?: Client;
	flow?: "authentication" | "registration";
	locale: string;
	identifier?: string;
	scopes?: string[];
}): ReactNode {
	const ceremony = useKeyedPromise(
		`${identifier}/${flow}/${scopes}`,
		() => client.auth.begin(flow, { scopes, store: createStore(`${identifier}/${flow}/${scopes}`) }),
		1000 * 60 * 5,
	);
	const [hash, setHash] = useState("");
	useEffect(() => {
		ceremony.onChange(() => setHash(id()));
		return () => {
			ceremony[Symbol.dispose]();
		};
	}, [ceremony]);

	useEffect(() => {
		if (ceremony.current?.step.kind === "component" && ceremony.current.step.prompt === "oauth2") {
			const url = new URL(globalThis.location.toString());
			const { code, state, scope } = Object.fromEntries(url.searchParams);
			if (code) {
				url.searchParams.delete("state");
				url.searchParams.delete("code");
				url.searchParams.delete("scope");
				globalThis.history.replaceState(null, "", url.toString());
				ceremony.submitPrompt({ code, state, scope });
			}
		}
	}, [ceremony, globalThis.location?.toString()]);

	const node = useMemo(() => (typeof children === "function" ? children(ceremony) : children), [ceremony.current, children]);

	return jsx(ClientAuthCeremonyContext.Provider, { value: ceremony, children: node }, hash);
}

/**
 * Renders the appropriate prompt for the current authentication step.
 * Delegates to the matching entry in `prompts` by the step's
 * `prompt` discriminator, or to `choice` for choice-type steps.
 *
 * @param props.choice Render function for choice-type steps.
 * @param props.prompts Map of prompt names to render functions.
 */
export function AuthenticationPrompt({ choice, prompts }: {
	choice: (ceremony: ClientAuthCeremony, prompts: Array<AuthenticationComponentPrompt>) => ReactNode;
	prompts: Record<string, (ceremony: ClientAuthCeremony, prompt: AuthenticationComponentPrompt) => ReactNode>;
}): ReactNode {
	const ceremony = useAuthenticationCeremony();
	let prompt = useMemo(() => {
		// deno-fmt-ignore
		return ceremony.current?.step.kind === "choice" ? choice(ceremony, ceremony.current?.step.prompts)
			: ceremony.current && ceremony.current.step.prompt in prompts ? prompts[ceremony.current!.step.prompt](ceremony, ceremony.current!.step)
			: undefined;
	}, [ceremony]);

	prompt ??= jsx(Fragment, {
		children: `No prompt for ${ceremony.current?.step.kind === "choice" ? "choice" : ceremony.current?.step.prompt}`,
	});
	return prompt;
}
