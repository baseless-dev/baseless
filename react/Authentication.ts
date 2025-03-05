// @deno-types="npm:@types/react@19"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { jsx } from "react/jsx-runtime";
import type { AuthenticationComponent, AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import type { AuthenticationStep } from "@baseless/core/authentication-step";
import type { AuthenticationResponse } from "@baseless/core/authentication-response";
import { useClient } from "./prelude.ts";
import { Client } from "@baseless/client";
import useKeyedPromise from "./useKeyedPromise.ts";
import { id } from "@baseless/core/id";

export interface AuthenticationController {
	key: string;
	component: AuthenticationComponent;
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
	flow = "authentication",
	scopes = [],
}: {
	children: ReactNode | ((controller: AuthenticationController) => ReactNode);
	client?: Client;
	flow?: "authentication" | "registration";
	scopes?: string[];
}): ReactNode {
	const initialState = useKeyedPromise(
		`${client.clientId}/${flow}/${scopes}`,
		() => client.fetch(`auth/begin`, { kind: flow, scopes }),
		1000 * 60 * 5,
	);
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

	const controller = useMemo(() => {
		return {
			key: id(),
			component: currentStep.step,
			reset: () => (setSteps([]), saveSteps(undefined)),
			back: () => (setSteps(steps.slice(0, -1)), saveSteps(undefined)),
			select: (step: AuthenticationComponent) => (setSteps([...steps, { ...currentStep, step }]), saveSteps(undefined)),
			send: (locale: string) =>
				client.fetch(flow === "authentication" ? `auth/send-prompt` : `auth/send-validation-code`, {
					state: currentStep.state,
					id: currentStep.step.kind === "component" ? currentStep.step.id : "",
					locale,
				}) as Promise<boolean>,
			submit: async (value: unknown) => {
				if (currentStep.step.kind === "component" && currentStep.step.prompt === "oauth2") {
					globalThis.location.href = currentStep.step.options.authorizationUrl as string;
					saveSteps([...steps]);
					return;
				}
				const result = currentStep.validating
					? await client.fetch(`auth/submit-validation-code`, {
						state: currentStep.state,
						id: currentStep.step.kind === "component" ? currentStep.step.id : "",
						code: value,
					}) as AuthenticationResponse
					: await client.fetch(`auth/submit-prompt`, {
						state: currentStep.state,
						id: currentStep.step.kind === "component" ? currentStep.step.id : "",
						value,
					}) as AuthenticationResponse;
				if ("accessToken" in result) {
					setSteps([]);
					saveSteps(undefined);
				} else {
					setSteps([...steps, result]);
					saveSteps(undefined);
				}
			},
		} satisfies AuthenticationController;
	}, [
		client,
		currentStep,
		steps,
		saveSteps,
	]);

	useEffect(() => {
		if (currentStep.step.kind === "component" && currentStep.step.prompt === "oauth2") {
			const url = new URL(globalThis.location.toString());
			const { code, state, scope } = Object.fromEntries(url.searchParams);
			if (code) {
				url.searchParams.delete("state");
				url.searchParams.delete("code");
				url.searchParams.delete("scope");
				(globalThis as any).history.replaceState(null, "", url.toString());
				(client.fetch(`auth/submit-prompt`, {
					state: currentStep.state,
					id: currentStep.step.id,
					value: { code, state, scope },
				}) as Promise<AuthenticationResponse>)
					.then((result) => {
						if ("accessToken" in result) {
							setSteps([]);
							saveSteps(undefined);
						} else {
							setSteps([...steps, result]);
							saveSteps(undefined);
						}
					});
			}
		}
	}, [client, currentStep, steps, setSteps, saveSteps]);

	const node = useMemo(() => (typeof children === "function" ? children(controller) : children), [children, controller]);

	return jsx(AuthenticationControllerContext.Provider, { value: controller, children: node }, controller.key);
}

export function AuthenticationPrompt({ choice, prompts }: {
	choice: (controller: Omit<AuthenticationController, "send" | "submit">, prompts: Array<AuthenticationComponentPrompt>) => ReactNode;
	prompts: Record<string, (controller: Omit<AuthenticationController, "select">, prompt: AuthenticationComponentPrompt) => ReactNode>;
}): ReactNode {
	const controller = useAuthenticationController();
	const prompt = useMemo(() => {
		// deno-fmt-ignore
		return controller.component.kind === "choice" ? choice(controller, controller.component.prompts)
			: controller.component.prompt in prompts ? prompts[controller.component.prompt](controller, controller.component)
			: undefined;
	}, [controller.component, prompts, controller]);

	if (!prompt) {
		throw new Error(`No prompt for ${controller.component.kind === "choice" ? "choice" : controller.component.prompt}`);
	}
	return prompt;
}
