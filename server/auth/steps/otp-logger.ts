import { AutoId } from "../../../shared/autoid.ts";
import { Context } from "../../context.ts";
import { createLogger } from "../../logger.ts";
import { AuthenticationChallenge } from "../flow.ts";
import { otp } from "../otp.ts";

export class AuthenticationChallengeOTPLogger extends AuthenticationChallenge {
	#logger = createLogger("auth-otp-logger");
	constructor({ icon, label }: { icon: string; label: Record<string, string> }) {
		super("otp:logger", icon, label, "otp");
	}
	send = async (_request: Request, context: Context, identity: AutoId) => {
		const code = otp({ digits: 6 });
		await context.identity.assignIdentityChallenge(identity, "otp:logger", code, 120);
		this.#logger.warn(`The OTP code is ${code}.`);
		return;
	};
	async challenge(request: Request, context: Context, identity: AutoId): Promise<boolean> {
		const formData = await request.formData();
		const code = formData.get("code");
		if (!code) {
			throw new Error();
		}
		return await context.identity.testIdentityChallenge(identity, "otp:logger", code.toString());
	}
}

export function otpLogger(options: ConstructorParameters<typeof AuthenticationChallengeOTPLogger>[0]) {
	return new AuthenticationChallengeOTPLogger(options);
}