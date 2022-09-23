import { ssr } from "./ssr.ts";
import Login from "./Login.tsx";
import { Locale, Localization } from "./localization.ts";
import { AuthConfiguration, AuthViews } from "https://baseless.dev/x/baseless/auth/config.ts";

export interface AuthUIConfiguration {
	locales: Locale[];
	localization: Record<Locale, Localization>;
	defaultLocale: Locale;
}

export interface AuthUIContext {
	currentLocale: Locale;
}

export default function createAuthUI(uiConfiguration: AuthUIConfiguration): AuthViews {
	return {
		login(request: Request, configuration: AuthConfiguration) {
			const url = new URL(request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				currentLocale,
			};
			return ssr(Login({ context, uiConfiguration, configuration }));
		},
	};
}
