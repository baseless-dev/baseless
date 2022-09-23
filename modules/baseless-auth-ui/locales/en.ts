import { Localization } from "../localization.ts";

const localization: Localization = {
	locale: "English",
	heading: "Welcome",
	signWithEmail: {
		heading: "To keep connected with us please sign in with your e-mail",
		placeholder: "you@example.com",
		signIn: "Sign in",
	},
	signWithOAuth: {
		heading: {
			soleSignIn: "To keep connected with us please sign in with",
			withEmail: "Or you can sign in with",
		},
		signIn(name: string) {
			return `Sign in with ${name}`;
		}
	},
};

export default localization;
