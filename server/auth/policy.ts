import * as Type from "@baseless/core/schema";
import type {
	AuthenticationComponentPrompt,
	Identity,
	IdentityChannel,
	IdentityComponent,
	IdentityComponentProvider,
	IdentityComponentProviderGetSetupPromptOptions,
	IdentityComponentProviderGetSignInPromptOptions,
	IdentityComponentProviderSetupIdentityComponentOptions,
	IdentityComponentProviderSkipSignInPromptOptions,
	IdentityComponentProviderVerifySignInPromptOptions,
} from "../provider.ts";

export interface PolicyIdentityComponentProviderOptions {
	policies: Policy[];
}

export class PolicyIdentityComponentProvider implements IdentityComponentProvider {
	#policies: Policy[];
	constructor(policies: Policy[]) {
		this.#policies = policies;
	}

	verifyRequiredDocumentAccepted(responses: Record<string, string>): boolean {
		return this.#policies
			.filter((policy) => policy.required === true)
			.every((policy) => policy.identifier in responses && responses[policy.identifier] === policy.version);
	}

	skipSignInPrompt(options: IdentityComponentProviderSkipSignInPromptOptions): Promise<boolean> {
		const isAllAccepted = Type.validate(PolicyResponse, options.identityComponent?.data) &&
			this.verifyRequiredDocumentAccepted(options.identityComponent?.data);
		return Promise.resolve(isAllAccepted);
	}

	getSignInPrompt(options: IdentityComponentProviderGetSignInPromptOptions): Promise<AuthenticationComponentPrompt> {
		return this.getSetupPrompt(options);
	}

	async verifySignInPrompt(options: IdentityComponentProviderVerifySignInPromptOptions): Promise<boolean | Identity["id"]> {
		const responses = options.value;
		if (options.identityComponent && Type.validate(PolicyResponse, responses) && this.verifyRequiredDocumentAccepted(responses)) {
			const identityComponent = {
				...options.identityComponent,
				data: {
					...options.identityComponent?.data,
					...responses,
				},
			};
			await options.service.document.atomic()
				.set(`auth/identity/${options.identityComponent!.identityId}/component/${options.componentId}`, identityComponent)
				.commit();
			return true;
		}
		return false;
	}

	getSetupPrompt({ componentId }: IdentityComponentProviderGetSetupPromptOptions): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: componentId,
			prompt: "policy",
			options: {
				policies: this.#policies,
			},
			sendable: false,
		});
	}

	setupIdentityComponent(
		{ value }: IdentityComponentProviderSetupIdentityComponentOptions,
	): Promise<[Omit<IdentityComponent, "identityId" | "componentId">, ...Omit<IdentityComponent | IdentityChannel, "identityId">[]]> {
		if (!Type.validate(PolicyResponse, value)) {
			return Promise.reject(new Error("Invalid policy response"));
		}
		if (!this.verifyRequiredDocumentAccepted(value)) {
			return Promise.reject(new Error("Required documents not accepted"));
		}
		return Promise.resolve([
			{
				data: { ...value },
				confirmed: true,
			},
		]);
	}
}

export interface Policy {
	identifier: string;
	version: string;
	required: boolean;
	name: Record<string, string>;
	content: Record<string, string>;
}

export const Policy: Type.TObject<{
	identifier: Type.TString;
	version: Type.TString;
	required: Type.TBoolean;
	name: Type.TRecord<Type.TString>;
	content: Type.TRecord<Type.TString>;
}, ["identifier", "version", "required", "name", "content"]> = Type.Object({
	identifier: Type.String(),
	version: Type.String(),
	required: Type.Boolean(),
	name: Type.Record(Type.String()),
	content: Type.Record(Type.String()),
}, ["identifier", "version", "required", "name", "content"]);

const PolicyResponse: Type.TRecord<Type.TString> = Type.Record(Type.String());
