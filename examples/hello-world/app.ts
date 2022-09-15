import { config } from "https://baseless.dev/x/baseless/config.ts";
import { anonymous, email, oneOf, password } from "https://baseless.dev/x/baseless/auth/mod.ts";
import { emailOTP } from "https://baseless.dev/x/baseless-auth-login-otp-email/mod.ts";
import authRenderer from "https://baseless.dev/x/baseless-auth-renderer/mod.tsx";

config.auth()
	.flow(
		// Anonymously
		anonymous(),
		// Or with email
		email(
			// and either
			oneOf(
				// a password
				password(),
				// or OTP by email
				emailOTP(),
			),
		),
	)
	.setRenderer(authRenderer)
	.onCreateIdentity((_ctx, _req, identity) => {
		console.log(`Identity created ${identity.id}`);
	})
	.onUpdateIdentity((_ctx, _req, identity) => {
		console.log(`Identity updated ${identity.id}`);
	})
	.onDeleteIdentity((_ctx, _req, identity) => {
		console.log(`Identity deleted ${identity.id}`);
	});
