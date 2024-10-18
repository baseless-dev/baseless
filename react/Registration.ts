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
import type { RegistrationStep } from "@baseless/core/registration-step";
import useKeyedPromise from "./useKeyedPromise.ts";
import { id } from "@baseless/core/id";
import type { AuthenticationDependencies } from "../server/types.ts";

export interface RegistrationController {
	key: string;
	currentComponent: AuthenticationComponent;
	reset: () => void;
	back: () => void;
	select: (current: AuthenticationComponent) => void;
	sendValidationCode: (locale: string) => Promise<boolean>;
	submitValidationCode: (code: string) => Promise<void>;
	submit: (value: unknown) => Promise<void>;
}

const RegistrationControllerContext = createContext<RegistrationController>(null!);

export function useRegistrationController(): RegistrationController {
	const controller = useContext(RegistrationControllerContext);
	if (!controller) {
		throw new Error("useRegistration must be used within an Registration");
	}
	return controller;
}

export function Registration({
	children,
	client = useClient(),
}: {
	children: ReactNode | ((controller: RegistrationController) => ReactNode);
	client: Client;
}): ReactNode {
	const authClient = client as never as TypedClientFromApplicationBuilder<
		ApplicationBuilder<
			AuthenticationDecoration,
			AuthenticationDependencies,
			AuthenticationRpcs,
			[],
			AuthenticationDocuments,
			AuthenticationCollections
		>
	>;

	const initialState = useKeyedPromise(client, () => authClient.rpc(["registration", "begin"], void 0), 1000 * 60 * 5);
	const [steps, setSteps] = useState<RegistrationStep[]>(() => {
		try {
			const saved = localStorage.getItem("baseless_registration");
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
			localStorage.setItem("baseless_registration", JSON.stringify(newSteps));
		} else {
			localStorage.removeItem("baseless_registration");
		}
	}, [setSteps]);

	const controller = useMemo(() => ({
		key: id(),
		currentComponent: currentStep.current,
		reset: () => (setSteps([]), saveSteps(undefined)),
		back: () => (setSteps(steps.slice(0, -1)), saveSteps(undefined)),
		select: (current: AuthenticationComponent) => (setSteps([...steps, { ...currentStep, current }]), saveSteps(undefined)),
		sendValidationCode: (locale: string) =>
			authClient.rpc(["registration", "sendValidationCode"], {
				state: currentStep.state,
				id: currentStep.current.kind === "component" ? currentStep.current.id : "",
				locale,
			}),
		submitValidationCode: (value: unknown) =>
			authClient.rpc(["registration", "submitValidationCode"], {
				state: currentStep.state,
				id: currentStep.current.kind === "component" ? currentStep.current.id : "",
				value,
			}).then((_) => {}),
		submit: async (value: unknown) => {
			if (currentStep.current.kind === "component" && currentStep.current.prompt === "oauth2") {
				window.location.href = currentStep.current.options.authorizationUrl as string;
				saveSteps([...steps]);
				return;
			}
			const result = await authClient.rpc(["registration", "submitPrompt"], {
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
	} satisfies RegistrationController), [
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
				authClient.rpc(["registration", "submitPrompt"], {
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

	return jsx(RegistrationControllerContext.Provider, { value: controller, children: node }, controller.key);
}

export function RegistrationPrompt({ choice, prompts }: {
	choice: (
		controller: Omit<RegistrationController, "send" | "sendValidationCode" | "submitValidationCode">,
		prompts: Array<AuthenticationComponentPrompt>,
	) => ReactNode;
	prompts: Record<string, (controller: Omit<RegistrationController, "select">, prompt: AuthenticationComponentPrompt) => ReactNode>;
}): ReactNode {
	const controller = useRegistrationController();
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
