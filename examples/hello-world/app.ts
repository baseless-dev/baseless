import { config } from "https://baseless.dev/x/baseless/config.ts";
import { chain, email, password } from "https://baseless.dev/x/baseless/auth/flow.ts";
import createAuthUI from "https://baseless.dev/x/baseless-auth-ui/mod.ts";
import authUIEn from "https://baseless.dev/x/baseless-auth-ui/locales/en.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";

const { publicKey, privateKey } = await generateKeyPair("PS512");

config.auth()
	.keys({ algo: "PS512", publicKey, privateKey })
	.flow(chain(email(), password()))
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
