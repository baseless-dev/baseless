import { config } from "https://baseless.dev/x/baseless/config.ts";
import * as flow from "https://baseless.dev/x/baseless/auth/flow.ts";
import createAuthUI from "https://baseless.dev/x/baseless-auth-ui/mod.ts";
import authUIEn from "https://baseless.dev/x/baseless-auth-ui/locales/en.ts";

config.auth()
	.flow(
		flow.chain(flow.email(), flow.password())
	)
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
