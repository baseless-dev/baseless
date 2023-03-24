export type Locale = string;

export interface Localization {
	locale: string;
	heading: string;
	signWithEmail: {
		heading: string;
		placeholder: string;
		signIn: string;
	};
	signWithOAuth: {
		heading: {
			soleSignIn: string;
			withEmail: string;
		};
		signIn(name: string): string;
	};
}
