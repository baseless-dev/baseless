import localeEn from "./locales/en.ts";
export interface Resources {
	icons: Record<string, string>;
	locales: Record<string, Translatables>;
}

export interface Translatables {
	readonly locale: string;
	readonly welcome: string;
	readonly signInWith: {
		email: TranslatableSignInWith;
		anonymous: TranslatableSignInWith;
		[key: string]: TranslatableSignInWith;
	};
}

export interface TranslatableSignInWith {
	label: string;
	dialogHtml?: string;
}
