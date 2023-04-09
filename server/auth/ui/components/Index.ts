import { Locale, Localization } from "../localization.ts";
import { AuthUIContext } from "../mod.ts";
import Layout from "./Layout.ts";

export default function Logged({ currentLocale, localization }: AuthUIContext & { localization: Record<Locale, Localization> }) {
	const l10n = localization[currentLocale];
	return Layout({
		title: "Signed In",
		subTitle: "You are currently logged in with",
		isFirstStep: true,
	}, [
		`<div class="text-center">
			<div class="inline-block">
				<img
					class="h-12 w-auto rounded-full"
					src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
				/>
			</div>
			<h4 class="text-lg font-bold">Jane Doe</h4>
			<p class="mt-4 text-xs text-gray-500">Not you? <a class="text-indigo-500" href="#">Sign out</a></p>
		</div>`,
	]);
}
