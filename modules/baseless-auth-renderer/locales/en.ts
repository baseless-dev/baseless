import { Translatables } from "../resources.ts";

const locale: Translatables = {
	locale: "English",
	welcome: "Welcome",
	signInWith: {
		email: {
			label: "Sign in with email",
		},
		anonymous: {
			label: "Sign in anonymously",
			dialogHtml:
				"This method will create an anonymous identity that can not be retrieve if your browser's session is lost.<br/><br/>If you plan to keep using the service, please upgrade your anonymous identity by signing in with another method.",
		},
	},
};

export default locale;
