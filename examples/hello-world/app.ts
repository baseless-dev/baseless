import { config } from "https://baseless.dev/x/baseless/config.ts";
import { chain, email, oauth, oneOf, password } from "https://baseless.dev/x/baseless/auth/flow.ts";
import createAuthUI from "https://baseless.dev/x/baseless-auth-ui/mod.ts";
import authUIEn from "https://baseless.dev/x/baseless-auth-ui/locales/en.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";

const { publicKey, privateKey } = await generateKeyPair("PS512");

const facebook = oauth({
	providerId: "facebook",
	providerLabel: {
		en: "Sign-in with Facebook"
	},
	providerIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>facebook</title><path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z" /></svg>`,
	clientId: "",
	clientSecret: "",
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
	scope: [],
});
const google = oauth({
	providerId: "google",
	providerLabel: {
		en: "Sign-in with Google",
	},
	providerIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>google</title><path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" /></svg>`,
	clientId: "",
	clientSecret: "",
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
	scope: [],
});
const github = oauth({
	providerId: "github",
	providerLabel: {
		en: "Sign-in with GitHub",
	},
	providerIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>github</title><path d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z" /></svg>`,
	clientId: "",
	clientSecret: "",
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
	scope: [],
})

config.auth()
	.flow(oneOf(
		chain(email(), password()),
		chain(email(), email(), password()),
		facebook,
		google,
		github
	))
	.keys({ algo: "PS512", publicKey, privateKey })
	.setViews(createAuthUI({
		defaultLocale: "en",
		locales: ["en"],
		localization: {
			en: authUIEn,
		},
	}));
// .onCreateIdentity((_ctx, _req, identity) => {
// 	console.log(`Identity created ${identity.id}`);
// })
// .onUpdateIdentity((_ctx, _req, identity) => {
// 	console.log(`Identity updated ${identity.id}`);
// })
// .onDeleteIdentity((_ctx, _req, identity) => {
// 	console.log(`Identity deleted ${identity.id}`);
// });
