import { AuthViewLoginParams } from "../../../auth/config.ts";
import { AuthStepEmailDefinition, authStepIdent, AuthStepNodeDefinition, AuthStepOAuthDefinition, AuthStepPasswordDefinition } from "../../../auth/flow.ts";
import { Localization } from "../localization.ts";
import { AuthUIContext } from "../mod.ts";
import Layout from "./Layout.ts";

type AuthStepOAuthProps = { step: AuthStepOAuthDefinition; l10n: Localization; currentLocale: string };
type AuthStepEmailProps = { step: AuthStepEmailDefinition; l10n: Localization; currentLocale: string };
type AuthStepPasswordProps = { step: AuthStepPasswordDefinition; l10n: Localization; currentLocale: string };

export default function Login({ steps, isFirstStep, currentLocale, localization }: AuthUIContext & AuthViewLoginParams) {
	const l10n = localization[currentLocale];
	return Layout({
		title: "Sign In",
		subTitle: "How would you like to continue?",
	}, [
		`<form action="/auth/login" method="GET" class="space-y-6">
			<nav class="space-y-1" aria-label="Sidebar">
				${steps.type === "oneOf" && steps.steps.map((step) => AuthStep({ step, l10n, currentLocale })).join("") || ""}
				${steps.type !== "oneOf" && AuthStep({ step: steps, l10n, currentLocale }) || ""}
			</nav>
		</form>
		${
			!isFirstStep && `<form action="/auth/login" method="POST" autocomplete="off">
				<button class="mt-6 block text-xs text-gray-500" type="submit" name="action" value="back">
					<svg class="inline-block h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
					</svg>
					Choose an other method
				</button>
			</form>` || ""
		}`,
	]);
}

function AuthStep(props: { step: AuthStepNodeDefinition; l10n: Localization; currentLocale: string }) {
	let input: string;
	switch (props.step.type) {
		case "email":
			return AuthStepEmail(props as AuthStepEmailProps);
		case "password":
			return AuthStepPassword(props as AuthStepPasswordProps);
		case "oauth":
			return AuthStepOAuth(props as AuthStepOAuthProps);
		default:
			return `<button
						disabled
						title="Unknown provider"
						class="group min-w-full flex items-center rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
					>
						<svg
							class="-ml-1 mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-hidden="true"
						>
							<path d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z" />
						</svg>
						<span class="truncate">Unknown provider</span>
					</button>`;
	}
}

function AuthStepEmail({ step, currentLocale }: { step: AuthStepEmailDefinition; currentLocale: string }) {
	return `<button
	 		type="submit"
	 		name="action"
	 		value="email"
			title="${step.providerLabel[currentLocale]}"
			class="group min-w-full flex items-center rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
		>
			<svg
				class="-ml-1 mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				${step.providerIcon}
			</svg>
			<span class="truncate">${step.providerLabel[currentLocale]}</span>
		</button>`;
}

function AuthStepPassword({ step, currentLocale }: { step: AuthStepPasswordDefinition; currentLocale: string }) {
	return `<button
	 		type="submit"
	 		name="action"
	 		value="password"
			title="${step.providerLabel[currentLocale]}"
			class="group min-w-full flex items-center rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
		>
			<svg
				class="-ml-1 mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				${step.providerIcon}
			</svg>
			<span class="truncate">${step.providerLabel[currentLocale]}</span>
		</button>`;
}

function AuthStepOAuth({ step, currentLocale }: AuthStepOAuthProps) {
	const id = authStepIdent(step);
	return `<button
	 		type="submit"
	 		name="action"
	 		value="${id}"
			title="${step.config.providerLabel[currentLocale]}"
			class="group min-w-full flex items-center rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
		>
			<svg
				class="-ml-1 mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				${step.config.providerIcon}
			</svg>
			<span class="truncate">${step.config.providerLabel[currentLocale]}</span>
		</button>`;
}
