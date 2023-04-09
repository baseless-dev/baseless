import Login from "./components/Login.ts";
import { Locale, Localization } from "./localization.ts";
import { AuthenticationViewPrompParams, AuthViews } from "../../auth/config.ts";
import PromptEmail from "./components/PromptEmail.ts";
import PromptPassword from "./components/PromptPassword.ts";
import PromptOTP from "./components/PromptOTP.ts";
import Index from "./components/Index.ts";
import RateLimited from "./components/RateLimited.ts";
import { Context } from "../../context.ts";

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
		index(request: Request, _context: Context): string {
			const url = new URL(request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return Index({ ...context });
		},
		rateLimited(request: Request, _context: Context): string {
			const url = new URL(request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return RateLimited({ ...context });
		},
		promptChoice(params: AuthenticationViewPrompParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return Login({ ...context, ...params });
		},
		promptEmail(params: AuthenticationViewPrompParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return PromptEmail({ ...context, ...params });
		},
		promptPassword(params: AuthenticationViewPrompParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return PromptPassword({ ...context, ...params });
		},
		promptOTP(params: AuthenticationViewPrompParams): string {
			const url = new URL(params.request.url);
			const currentLocale = url.searchParams.get("locale") ?? uiConfiguration.defaultLocale;
			const context: AuthUIContext = {
				...uiConfiguration,
				currentLocale,
			};
			return PromptOTP({ ...context, ...params });
		},
	};
}
