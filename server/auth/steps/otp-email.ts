import { AutoId } from "../../../shared/autoid.ts";
import { Context } from "../../context.ts";
import { createLogger } from "../../logger.ts";
import { AuthenticationChallenge } from "../flow.ts";
import { otp } from "../otp.ts";

export class AuthenticationChallengeOTPEmail extends AuthenticationChallenge {
	#logger = createLogger("auth-otp-email");
	#subject: Record<string, string>;
	#text: Record<string, string>;
	#html?: Record<string, string>;
	constructor(
		{ icon, label, subject, text, html }: {
			icon: string;
			label: Record<string, string>;
			subject: Record<string, string>;
			text: Record<string, string>;
			html?: Record<string, string>;
		},
	) {
		super("otp:email", icon, label, "otp");
		this.#subject = subject;
		this.#text = text;
		this.#html = html;
	}
	send = async (_request: Request, context: Context, identity: AutoId) => {
		const code = otp({ digits: 6 });
		const identifications = await context.identity.listIdentityIdentification(identity);
		const emails = identifications.filter(id => id.identifier === "email");
		if (emails.length === 0) {
			throw new Error(`Identity doesn't have an email configured.`);
		}
		await Promise.all([
			context.identity.assignIdentityChallenge(identity, "otp:email", code, 120),
			// TODO get culture from request
			...emails.map(id => context.email.send({ to: id.uniqueId, subject: this.#subject["en"], text: `You code is ${code}.` }))
		]);
		return;
	};
	async challenge(request: Request, context: Context, identity: AutoId): Promise<boolean> {
		const formData = await request.formData();
		const code = formData.get("code");
		if (!code) {
			throw new Error();
		}
		return await context.identity.testIdentityChallenge(identity, "otp:email", code.toString());
	}
}

export function otpEmail(options: ConstructorParameters<typeof AuthenticationChallengeOTPEmail>[0]) {
	return new AuthenticationChallengeOTPEmail(options);
}