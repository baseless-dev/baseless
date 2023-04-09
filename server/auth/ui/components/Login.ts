import { AuthenticationViewPrompParams } from "../../../auth/config.ts";
import { AuthenticationChallenge, AuthenticationChoice, AuthenticationIdentification, AuthenticationSequence, AuthenticationStep } from "../../../auth/flow.ts";
import { Localization } from "../localization.ts";
import { AuthUIContext } from "../mod.ts";
import Layout from "./Layout.ts";

type AuthenticationStepProps = { step: AuthenticationStep; l10n: Localization; currentLocale: string };

export default function Login({ step, isFirstStep, currentLocale, localization }: AuthUIContext & AuthenticationViewPrompParams) {
	const l10n = localization[currentLocale];
	return Layout({
		title: "Sign In",
		subTitle: "How would you like to continue?",
		isFirstStep,
	}, [
		`<div class="space-y-6">
			<nav class="space-y-1" aria-label="Sidebar">
				${step instanceof AuthenticationChoice && step.choices.map((step) => AuthStep({ step, l10n, currentLocale })).join("") || ""}
				${step instanceof AuthenticationSequence && AuthStep({ step: step, l10n, currentLocale }) || ""}
			</nav>
		</div>`,
	]);
}

function AuthStep({ step, currentLocale }: AuthenticationStepProps) {
	let input: string;
	if (step instanceof AuthenticationIdentification || step instanceof AuthenticationChallenge) {
		return `<a
					href="/auth/login/${step.id}"
					title="${step.label[currentLocale]}"
					class="group min-w-full flex items-center rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
				>
					<svg
						class="-ml-1 mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						${step.icon}
					</svg>
					<span class="truncate">${step.label[currentLocale]}</span>
				</a>`;
	}
	return `<span
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
			</span>`;
}
