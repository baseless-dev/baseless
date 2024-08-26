import { IdentityComponentProvider } from "../provider.ts";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "../component.ts";
import { AuthenticationContext } from "../types.ts";

export interface PolicyDocumentDefinition {
	identifier: string;
	version: string;
	required: boolean;
	name: Record<string, string>;
	content: Record<string, string>;
}

function isPolicyResponse(value: unknown): value is Record<string, string> {
	return !!value && typeof value === "object" &&
		Object.keys(value).every((k) => typeof k === "string");
}

export class PolicyIdentityComponentProvider implements IdentityComponentProvider {
	#documents: PolicyDocumentDefinition[];
	constructor(documents: PolicyDocumentDefinition[]) {
		this.#documents = documents;
	}

	verifyRequiredDocumentAccepted(responses: Record<string, string>): boolean {
		return this.#documents
			.filter((doc) => doc.required === true)
			.every((doc) =>
				doc.identifier in responses && responses[doc.identifier] === doc.version
			);
	}

	buildIdentityComponent(
		{ value }: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<Omit<IdentityComponent, "identityId" | "componentId">> {
		if (!isPolicyResponse(value)) {
			return Promise.reject(new Error("Invalid policy response"));
		}
		if (!this.verifyRequiredDocumentAccepted(value)) {
			return Promise.reject(new Error("Required documents not accepted"));
		}
		return Promise.resolve({
			data: {
				responses: value,
			},
			confirmed: true,
		});
	}
	getSignInPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		// const responses = options.identityComponent?.data.responses;
		// if (
		// 	isPolicyResponse(responses) &&
		// 	this.verifyRequiredDocumentAccepted(responses)
		// ) {
		// 	return Promise.resolve(undefined);
		// }
		return Promise.resolve({
			kind: "component",
			id: options.componentId,
			prompt: "policy",
			options: {
				documents: this.#documents,
			},
		});
	}
	verifySignInPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<boolean | Identity["identityId"]> {
		const responses = options.value;
		return Promise.resolve(
			isPolicyResponse(responses) && this.verifyRequiredDocumentAccepted(responses),
		);
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
			prompt: "policy",
			options: {
				documents: this.#documents,
			},
		});
	}
}
