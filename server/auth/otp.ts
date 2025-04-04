import type {
	AuthenticationComponentPrompt,
	ID,
	Identity,
	IdentityChannel,
	IdentityComponent,
	IdentityComponentProvider,
	IdentityComponentProviderGetSetupPromptOptions,
	IdentityComponentProviderGetSignInPromptOptions,
	IdentityComponentProviderSetupIdentityComponentOptions,
	IdentityComponentProviderVerifySignInPromptOptions,
	IdentityComponentSendSignInPromptOptions,
	Notification,
	RegisteredContext,
	ServiceCollection,
} from "../provider.ts";
import { otp, OTPOptions } from "@baseless/core/otp";

export interface OtpComponentProviderOptions {
	otp: OTPOptions;
	signInNotification: (options: {
		identityId?: ID<"id_">;
		code: string;
		context: RegisteredContext;
		identityComponent?: IdentityComponent;
		locale: string;
		service: ServiceCollection;
	}) => Notification | Promise<Notification>;
}

export class OtpComponentProvider implements IdentityComponentProvider {
	#options: OtpComponentProviderOptions;

	constructor(options: OtpComponentProviderOptions) {
		this.#options = options;
	}

	getSignInPrompt(options: IdentityComponentProviderGetSignInPromptOptions): Promise<AuthenticationComponentPrompt> {
		return this.getSetupPrompt(options);
	}

	async sendSignInPrompt(options: IdentityComponentSendSignInPromptOptions): Promise<boolean> {
		if (
			!options.identityComponent ||
			!options.identityComponent.data.channelId ||
			typeof options.identityComponent.data.channelId !== "string"
		) {
			return false;
		}
		const code = otp(this.#options.otp);
		const key = `auth-otp-sign-in-code/${options.componentId}/${options.identityComponent.identityId}`;
		await options.service.kv.put(key, code, { expiration: 1000 * 60 * 5 });
		const notification = await this.#options.signInNotification({
			code,
			context: options.context,
			identityComponent: options.identityComponent,
			identityId: options.identityComponent.identityId,
			locale: options.locale,
			service: options.service,
		});
		return options.service.notification.notifyChannel(
			options.identityComponent.identityId,
			options.identityComponent.data.channelId,
			notification,
		);
	}

	async verifySignInPrompt(options: IdentityComponentProviderVerifySignInPromptOptions): Promise<boolean | Identity["id"]> {
		if (!options.identityComponent) {
			return false;
		}
		const key = `auth-otp-sign-in-code/${options.componentId}/${options.identityComponent.identityId}`;
		const code = await options.service.kv.get(key).catch((_) => undefined);
		if (code?.value === `${options.value}`) {
			await options.service.kv.delete(key);
			return true;
		}
		return false;
	}

	getSetupPrompt({ componentId }: IdentityComponentProviderGetSetupPromptOptions): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: componentId,
			prompt: "otp",
			options: {
				digits: this.#options.otp.digits,
			},
			sendable: true,
		});
	}

	setupIdentityComponent(
		{ value }: IdentityComponentProviderSetupIdentityComponentOptions,
	): Promise<[Omit<IdentityComponent, "identityId" | "componentId">, ...Omit<IdentityComponent | IdentityChannel, "identityId">[]]> {
		return Promise.resolve([{
			identification: `${value}`,
			data: {},
			confirmed: false,
		}]);
	}
}
