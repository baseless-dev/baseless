import type {
	AuthenticationComponentPrompt,
	ID,
	Identity,
	IdentityChannel,
	IdentityComponent,
	IdentityComponentProvider,
	IdentityComponentProviderGetSetupPromptOptions,
	IdentityComponentProviderGetSignInPromptOptions,
	IdentityComponentProviderGetValidationPromptOptions,
	IdentityComponentProviderSendValidationPromptOptions,
	IdentityComponentProviderSetupIdentityComponentOptions,
	IdentityComponentProviderVerifySignInPromptOptions,
	IdentityComponentProviderVerifyValidationPromptOptions,
	Notification,
	RegisteredContext,
	ServiceCollection,
} from "../provider.ts";
import { otp } from "@baseless/core/otp";

export interface EmailIdentityComponentProviderOptions {
	setupOtp?: boolean;
	sendValidationNotification: (options: {
		identityId?: ID<"id_">;
		code: string;
		context: RegisteredContext;
		identityComponent?: IdentityComponent;
		locale: string;
		service: ServiceCollection;
	}) => Notification | Promise<Notification>;
}

export class EmailIdentityComponentProvider implements IdentityComponentProvider {
	#options: EmailIdentityComponentProviderOptions;

	constructor(options: EmailIdentityComponentProviderOptions) {
		this.#options = options;
	}

	getSignInPrompt(options: IdentityComponentProviderGetSignInPromptOptions): Promise<AuthenticationComponentPrompt> {
		return this.getSetupPrompt(options);
	}

	async verifySignInPrompt(options: IdentityComponentProviderVerifySignInPromptOptions): Promise<boolean | Identity["id"]> {
		if (typeof options.value !== "string") {
			return false;
		}
		// deno-fmt-ignore
		const doc = await options.service.document.get(`auth/identity-by-identification/${options.componentId}/${options.value}`).catch((_) => undefined);
		return doc ? doc.data as Identity["id"] : false;
	}

	getSetupPrompt({ componentId }: IdentityComponentProviderGetSetupPromptOptions): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: componentId,
			prompt: "email",
			options: {},
			sendable: false,
		});
	}

	setupIdentityComponent(
		{ value }: IdentityComponentProviderSetupIdentityComponentOptions,
	): Promise<[Omit<IdentityComponent, "identityId" | "componentId">, ...Omit<IdentityComponent | IdentityChannel, "identityId">[]]> {
		return Promise.resolve([
			{
				identification: `${value}`,
				data: {},
				confirmed: false,
			},
			{
				channelId: "email",
				data: { email: `${value}` },
				confirmed: true,
			},
			...(this.#options.setupOtp === true
				? [{
					componentId: "otp",
					identification: `${value}`,
					data: {},
					confirmed: true,
				}]
				: []),
		]);
	}

	getValidationPrompt(options: IdentityComponentProviderGetValidationPromptOptions): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: options.componentId,
			prompt: "otp",
			options: {
				digits: 8,
			},
			sendable: true,
		});
	}

	async sendValidationPrompt(options: IdentityComponentProviderSendValidationPromptOptions): Promise<boolean> {
		const code = otp({ digits: 8 });
		await options.service.kv.put(
			`email-validation-code/${options.identityComponent!.identityId}`,
			code,
			{ expiration: 1000 * 60 * 5 },
		);
		const notification = await this.#options.sendValidationNotification({
			code,
			context: options.context,
			identityComponent: options.identityComponent,
			identityId: options.identityComponent?.identityId,
			locale: options.locale,
			service: options.service,
		});
		return options.service.notification.unsafeNotifyChannel({
			identityId: options.identityComponent!.identityId,
			channelId: "email",
			confirmed: true,
			data: {
				email: options.identityComponent!.identification,
			},
		}, notification);
	}

	async verifyValidationPrompt(options: IdentityComponentProviderVerifyValidationPromptOptions): Promise<boolean> {
		// deno-fmt-ignore
		const code = await options.service.kv.get(`email-validation-code/${options.identityComponent!.identityId}`);
		return code.value === `${options.value}`;
	}
}
