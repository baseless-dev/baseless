import { Locale, Localization } from "../localization.ts";
import { AuthUIContext } from "../mod.ts";
import Layout from "./Layout.ts";

export default function RateLimited({ currentLocale, localization }: AuthUIContext & { localization: Record<Locale, Localization> }) {
	const _l10n = localization[currentLocale];
	return Layout({
		title: "Too Many Attempt",
		subTitle: "Please retry in a few moment",
		isFirstStep: true,
	}, [
		`<a href="/auth/login" class="mt-6 block text-xs text-gray-500">
			<svg class="inline-block h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
			</svg>
			Retry
		</a>`,
	]);
}
