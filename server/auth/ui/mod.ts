import Login from "./components/Login.ts";
import { Locale, Localization } from "./localization.ts";
import { AuthViewLoginParams, AuthViews } from "../../auth/config.ts";
import PromptEmail from "./components/PromptEmail.ts";
import PromptPassword from "./components/PromptPassword.ts";
import Logged from "./components/Logged.ts";

export interface AuthUIConfiguration {
	locales: Locale[];
	localization: Record<Locale, Localization>;
	defaultLocale: Locale;
}

export interface AuthUIContext extends AuthUIConfiguration {
	currentLocale: Locale;
}

export default function createAuthUI(uiConfiguration: AuthUIConfiguration): AuthViews {
	return {
		loggedin(params: AuthViewLoginParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return Logged({ ...context, ...params });
		},
		login(params: AuthViewLoginParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return Login({ ...context, ...params });
		},
		promptEmail(params: AuthViewLoginParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return PromptEmail({ ...context, ...params });
		},
		promptPassword(params: AuthViewLoginParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return PromptPassword({ ...context, ...params });
		},
	};
}
