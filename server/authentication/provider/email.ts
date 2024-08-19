import { IdentityComponentProvider } from "../provider.ts";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "../component.ts";
import { AuthenticationContext } from "../types.ts";
import { otp } from "../otp.ts";

export class EmailIdentityComponentProvider implements IdentityComponentProvider {
	buildIdentityComponent(
		{ value }: {
			componentId: string;
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
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: options.componentId,
			prompt: "email",
			options: {},
		});
	}
	async verifySignInPrompt(
		options: {
			componentId: string;
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
			options.componentId,
			options.value,
		]).catch((_) => undefined);
		return doc ? doc.data : false;
	}
	getSetupPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: options.componentId,
			prompt: "email",
			options: {},
		});
	}
	getValidationPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: options.componentId,
			prompt: "otp",
			options: {
				digits: 8,
			},
		});
	}
	async sendValidationPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			locale: string;
			identityId: Identity["identityId"];
		},
	): Promise<boolean> {
		const code = otp({ digits: 8 });
		await options.context.kv.put(
			["email-validation-code", options.identityId],
			code,
			{
				expiration: 1000 * 60 * 5,
			},
		);
		// TODO configurable notification
		await options.context.notification.sendNotification(options.identityId, {
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
			componentId: string;
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
