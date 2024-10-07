// @deno-types="npm:@types/react@18"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { jsx } from "react/jsx-runtime";
import { useClient } from "./useClient.ts";
import type { Client, TypedClientFromApplicationBuilder } from "@baseless/client";
import type {
	ApplicationBuilder,
	AuthenticationCollections,
	AuthenticationDecoration,
	AuthenticationDocuments,
	AuthenticationRpcs,
} from "@baseless/server";
import type { AuthenticationComponent, AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import type { AuthenticationStep } from "@baseless/core/authentication-step";
import useKeyedPromise from "./useKeyedPromise.ts";
import { id } from "@baseless/core/id";

export interface AuthenticationController {
	key: string;
	currentComponent: AuthenticationComponent;
	reset: () => void;
	back: () => void;
	select: (current: AuthenticationComponent) => void;
	send: (locale: string) => Promise<boolean>;
	submit: (value: unknown) => Promise<void>;
}

const AuthenticationControllerContext = createContext<AuthenticationController>(null!);

export function useAuthenticationController(): AuthenticationController {
	const controller = useContext(AuthenticationControllerContext);
	if (!controller) {
		throw new Error("useAuthentication must be used within an Authentication");
	}
	return controller;
}

export function Authentication({
	children,
	client = useClient(),
}: {
	children: ReactNode | ((controller: AuthenticationController) => ReactNode);
	client: Client;
}): ReactNode {
	const authClient = client as never as TypedClientFromApplicationBuilder<
		ApplicationBuilder<
			AuthenticationDecoration,
			AuthenticationRpcs,
			[],
			AuthenticationDocuments,
			AuthenticationCollections
		>
	>;

	const initialState = useKeyedPromise(client, () => authClient.rpc(["authentication", "begin"], []), 1000 * 60 * 5);
	const [steps, setSteps] = useState<AuthenticationStep[]>(() => {
		try {
			const saved = localStorage.getItem("baseless_authentication");
			if (saved) {
				return JSON.parse(saved);
			}
			// deno-lint-ignore no-empty
		} catch (_error) {}
		return [];
	});

	const currentStep = steps[steps.length - 1] ?? initialState;

	const saveSteps = useCallback((newSteps: typeof steps | undefined) => {
		if (newSteps) {
			localStorage.setItem("baseless_authentication", JSON.stringify(newSteps));
		} else {
			localStorage.removeItem("baseless_authentication");
		}
	}, [setSteps]);

	const controller = useMemo(() => ({
		key: id(),
		currentComponent: currentStep.current,
		reset: () => (setSteps([]), saveSteps(undefined)),
		back: () => (setSteps(steps.slice(0, -1)), saveSteps(undefined)),
		select: (current: AuthenticationComponent) => (setSteps([...steps, { ...currentStep, current }]), saveSteps(undefined)),
		send: (locale: string) =>
			authClient.rpc(["authentication", "sendPrompt"], {
				state: currentStep.state,
				id: currentStep.current.kind === "component" ? currentStep.current.id : "",
				locale,
			}),
		submit: async (value: unknown) => {
			if (currentStep.current.kind === "component" && currentStep.current.prompt === "oauth2") {
				window.location.href = currentStep.current.options.authorizationUrl as string;
				saveSteps([...steps]);
				return;
			}
			const result = await authClient.rpc(["authentication", "submitPrompt"], {
				state: currentStep.state,
				id: currentStep.current.kind === "component" ? currentStep.current.id : "",
				value,
			});
			if ("access_token" in result) {
				setSteps([]);
				saveSteps(undefined);
			} else {
				setSteps([...steps, result]);
				saveSteps(undefined);
			}
		},
	} satisfies AuthenticationController), [
		authClient,
		currentStep,
		steps,
		saveSteps,
	]);

	useEffect(() => {
		if (currentStep.current.kind === "component" && currentStep.current.prompt === "oauth2") {
			const url = new URL(window.location.toString());
			const { code, state, scope } = Object.fromEntries(url.searchParams);
			if (code) {
				url.searchParams.delete("state");
				url.searchParams.delete("code");
				url.searchParams.delete("scope");
				(globalThis as any).history.replaceState(null, "", url.toString());
				authClient.rpc(["authentication", "submitPrompt"], {
					state: currentStep.state,
					id: currentStep.current.id,
					value: { code, state, scope },
				})
					.then((result) => {
						if ("access_token" in result) {
							setSteps([]);
							saveSteps(undefined);
						} else {
							setSteps([...steps, result]);
							saveSteps(undefined);
						}
					});
			}
		}
	}, [authClient, currentStep, steps, setSteps, saveSteps]);

	const node = useMemo(() => (typeof children === "function" ? children(controller) : children), [children, controller]);

	return jsx(AuthenticationControllerContext.Provider, { value: controller, children: node }, controller.key);
}

export function AuthenticationPrompt({ choice, prompts }: {
	choice: (controller: Omit<AuthenticationController, "send" | "submit">, prompts: Array<AuthenticationComponentPrompt>) => ReactNode;
	prompts: Record<string, (controller: Omit<AuthenticationController, "select">, prompt: AuthenticationComponentPrompt) => ReactNode>;
}): ReactNode {
	const controller = useAuthenticationController();
	const prompt = useMemo(() => {
		return controller.currentComponent.kind === "choice"
			? choice(controller, controller.currentComponent.prompts)
			: controller.currentComponent.prompt in prompts
			? prompts[controller.currentComponent.prompt](controller, controller.currentComponent)
			: undefined;
	}, [controller.currentComponent, prompts, controller]);

	if (!prompt) {
		throw new Error(`No prompt for ${controller.currentComponent.kind === "choice" ? "choice" : controller.currentComponent.prompt}`);
	}
	return prompt;
}
