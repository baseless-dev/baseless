import { AuthenticationViewPrompParams } from "../../../auth/config.ts";
// import { authStepIdent, AuthStepNodeDefinition, AuthStepOAuthDefinition } from "../../../auth/flow.ts";
// import { Localization } from "../localization.ts";
import { AuthUIContext } from "../mod.ts";
import Layout from "./Layout.ts";

export default function PromptOTP({ step, isFirstStep, isLastStep, currentLocale, localization }: AuthUIContext & AuthenticationViewPrompParams) {
	const l10n = localization[currentLocale];
	return Layout({ title: "Enter code", subTitle: "Enter the code that you received by email" }, [
		`<form action="/auth/login/${step.id}" method="POST" autocomplete="off">
			<div class="mt-2 flex rounded-md shadow-sm">
				<div class="relative flex flex-grow items-stretch focus-within:z-10">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
						<svg class="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M4,17V9H2V7H6V17H4M22,15C22,16.11 21.1,17 20,17H16V15H20V13H18V11H20V9H16V7H20A2,2 0 0,1 22,9V10.5A1.5,1.5 0 0,1 20.5,12A1.5,1.5 0 0,1 22,13.5V15M14,15V17H8V13C8,11.89 8.9,11 10,11H12V9H8V7H12A2,2 0 0,1 14,9V11C14,12.11 13.1,13 12,13H10V15H14Z" />
						</svg>
					</div>
					<input
						type="text"
						name="code"
						id="code"
						class="block w-full rounded-none rounded-l-md border-0 py-1.5 pl-10 tracking-[1em] text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
						placeholder="123456"
						maxlength="6"
					/>
				</div>
				<button type="submit" class="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
					${isLastStep ? "Sign In" : "Continue"}
				</button>
			</div>
			<p class="mt-4 text-xs text-gray-500">Didn't receive a code? <a class="text-indigo-500" href="#">Resend code</a></p>
		</form>`,
	]);
}
