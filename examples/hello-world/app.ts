import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { EmailAuthentificationIdenticator } from "../../providers/auth-email/mod.ts";
import { LoggerMessageProvider } from "../../providers/message-logger/mod.ts";
import { PasswordAuthentificationChallenger } from "../../providers/auth-password/mod.ts";
import { config } from "../../common/server/config/config.ts";
import { TOTPLoggerAuthentificationChallenger } from "../../providers/auth-totp-logger/mod.ts";
import * as h from "../../common/auth/ceremony/component/helpers.ts";

const { publicKey, privateKey } = await generateKeyPair("PS512");
const email = new EmailAuthentificationIdenticator(
	new LoggerMessageProvider(),
);
const password = new PasswordAuthentificationChallenger();
const totp = new TOTPLoggerAuthentificationChallenger({
	period: 60,
	algorithm: "SHA-256",
	digits: 6,
});

config.asset().setEnabled(true);

config.auth()
	.setEnabled(true)
	.setSecurityKeys({ algo: "PS512", publicKey, privateKey })
	.setSecuritySalt("foobar")
	.setCeremony(
		h.oneOf(
			h.sequence(email, password),
			h.sequence(email, totp),
		),
	);