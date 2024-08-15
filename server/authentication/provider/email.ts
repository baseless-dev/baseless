import { IdentityComponentProvider } from "../provider.ts";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "../component.ts";
import { AuthenticationContext } from "../application.ts";
import { otp } from "../otp.ts";

export class EmailIdentityComponentProvider extends IdentityComponentProvider {
	buildIdentityComponent(
		{ value }: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<Omit<IdentityComponent, "identityId" | "componentId">> {
		return Promise.resolve({
			identification: `${value}`,
			data: {},
			confirmed: false,
		});
	}
	getSignInPrompt(
		_options: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: this.id,
			prompt: "email",
			options: {},
		});
	}
	async verifySignInPrompt(
		options: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<boolean | Identity["identityId"]> {
		if (typeof options.value !== "string") {
			return false;
		}
		const doc = await options.context.document.get([
			"identifications",
			this.id,
			options.value,
		]).catch((_) => undefined);
		return doc ? doc.data : false;
	}
	getSetupPrompt(
		_options: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: "email",
			prompt: "email",
			options: {},
		});
	}
	getValidationPrompt(
		_options: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<AuthenticationComponentPrompt | undefined> {
		return Promise.resolve({
			kind: "component",
			id: this.id,
			prompt: "otp",
			options: {
				digits: 8,
			},
		});
	}
	async sendValidationPrompt(
		options: {
			context: AuthenticationContext;
			locale: string;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<boolean> {
		const code = otp({ digits: 8 });
		await options.context.kv.put(
			["email-validation-code", options.identityComponent!.identityId],
			code,
			{
				expiration: 1000 * 60 * 5,
			},
		);
		// TODO configurable notification
		await options.context.notification.sendNotification(options.identityComponent!.identityId, {
			subject: "Your verification code",
			content: {
				"text/x-code": `${code}`,
				"text/plain": `Your verification code is ${code}`,
				"text/html": `Your verification code is <strong>${code}</strong>`,
			},
		});
		return true;
	}
	async verifyValidationPrompt(
		options: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<boolean> {
		const code = await options.context.kv.get([
			"email-validation-code",
			options.identityComponent!.identityId,
		]);
		return code.value === `${options.value}`;
	}
}
