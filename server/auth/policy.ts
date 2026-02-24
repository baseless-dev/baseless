import * as z from "@baseless/core/schema";
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
import { ref } from "@baseless/core/ref";

/** Options for constructing a {@link PolicyIdentityComponentProvider}. */
export interface PolicyIdentityComponentProviderOptions {
	policies: Policy[];
}

/**
 * {@link IdentityComponentProvider} that presents terms-of-service /
 * privacy-policy acceptance prompts to users during sign-in or registration.
 */
export class PolicyIdentityComponentProvider implements IdentityComponentProvider {
	#policies: Policy[];
	constructor(policies: Policy[]) {
		this.#policies = policies;
	}

	/**
	 * Returns `true` when all required {@link Policy} documents have been
	 * accepted in `responses`.
	 * @param responses Map of policy identifiers to accepted version strings.
	 */
	verifyRequiredDocumentAccepted(responses: Record<string, string>): boolean {
		return this.#policies
			.filter((policy) => policy.required === true)
			.every((policy) => policy.identifier in responses && responses[policy.identifier] === policy.version);
	}

	skipSignInPrompt(options: IdentityComponentProviderSkipSignInPromptOptions): Promise<boolean> {
		const isAllAccepted = z.guard(PolicyResponse, options.identityComponent?.data) &&
			this.verifyRequiredDocumentAccepted(options.identityComponent?.data);
		return Promise.resolve(isAllAccepted);
	}

	getSignInPrompt(options: IdentityComponentProviderGetSignInPromptOptions): Promise<AuthenticationComponentPrompt> {
		return this.getSetupPrompt(options);
	}

	async verifySignInPrompt(options: IdentityComponentProviderVerifySignInPromptOptions): Promise<boolean | Identity["id"]> {
		const responses = options.value;
		if (options.identityComponent && z.guard(PolicyResponse, responses) && this.verifyRequiredDocumentAccepted(responses)) {
			const identityComponent = {
				...options.identityComponent,
				data: {
					...options.identityComponent?.data,
					...responses,
				},
			};
			await options.service.document.atomic()
				.set(
					ref("auth/identity/:id/component/:key", { id: options.identityComponent!.identityId, key: options.componentId }) as never,
					identityComponent as never,
				)
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
		if (!z.guard(PolicyResponse, value)) {
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

/**
 * A single policy (terms, privacy notice, etc.) that users must accept.
 * Paired with a Zod schema const of the same name.
 */
export interface Policy {
	identifier: string;
	version: string;
	required: boolean;
	name: Record<string, string>;
	content: Record<string, string>;
}

/** Zod schema for {@link Policy}. */
export const Policy = z.strictObject({
	identifier: z.string(),
	version: z.string(),
	required: z.boolean(),
	name: z.record(z.string(), z.string()),
	content: z.record(z.string(), z.string()),
}).meta({ id: "Policy" });

const PolicyResponse = z.record(z.string(), z.string());
