import { config } from "https://baseless.dev/x/baseless/config.ts";
import { anonymous, email, oneOf, password } from "https://baseless.dev/x/baseless/auth/mod.ts";
import { emailOTP } from "https://baseless.dev/x/baseless-auth-login-otp-email/mod.ts";

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
				emailOTP()
			)
		),
	)
	.onCreateIdentity((_ctx, identity) => {
		console.log(`Identity created ${identity.id}`);
	})
	.onUpdateIdentity((_ctx, identity) => {
		console.log(`Identity updated ${identity.id}`);
	})
	.onDeleteIdentity((_ctx, identity) => {
		console.log(`Identity deleted ${identity.id}`);
	})
