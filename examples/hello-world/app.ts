import { config } from "https://baseless.dev/x/baseless/config.ts";
import { chain, oneOf, oauth, email, password } from "https://baseless.dev/x/baseless/auth/flow.ts";
import createAuthUI from "https://baseless.dev/x/baseless-auth-ui/mod.ts";
import authUIEn from "https://baseless.dev/x/baseless-auth-ui/locales/en.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";

const { publicKey, privateKey } = await generateKeyPair("PS512");

const facebook = oauth({
	providerId: "facebook",
	providerLabel: {},
	providerIcon: ``,
	clientId: "",
	clientSecret: "",
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
	scope: [],
});

config.auth()
	.keys({ algo: "PS512", publicKey, privateKey })
	.flow(oneOf(chain(email(), password()), facebook))
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
