import { IdentityComponentProvider } from "../identity_component_provider.ts";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import { AuthenticationContext } from "../types.ts";

export interface PolicyDocument {
	identifier: string;
	version: string;
	required: boolean;
	name: Record<string, string>;
	content: Record<string, string>;
}

function isPolicyResponse(value: unknown): value is Record<string, string> {
	return !!value && typeof value === "object" &&
		Object.values(value).every((v) => typeof v === "string");
}

export class PolicyIdentityComponentProvider implements IdentityComponentProvider {
	#documents: PolicyDocument[];
	constructor(documents: PolicyDocument[]) {
		this.#documents = documents;
	}

	verifyRequiredDocumentAccepted(responses: Record<string, string>): boolean {
		return this.#documents
			.filter((doc) => doc.required === true)
			.every((doc) => doc.identifier in responses && responses[doc.identifier] === doc.version);
	}

	skipSignInPrompt(options: {
		componentId: string;
		context: AuthenticationContext;
		identityComponent?: IdentityComponent;
	}): Promise<boolean> {
		const isAllAccepted = isPolicyResponse(options.identityComponent?.data) &&
			this.verifyRequiredDocumentAccepted(options.identityComponent?.data);
		return Promise.resolve(isAllAccepted);
	}

	getSignInPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		return this.getSetupPrompt(options);
	}
	async verifySignInPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<boolean | Identity["identityId"]> {
		const responses = options.value;
		if (
			options.identityComponent &&
			isPolicyResponse(responses) &&
			this.verifyRequiredDocumentAccepted(responses)
		) {
			const identityComponent = {
				...options.identityComponent,
				data: {
					...options.identityComponent?.data,
					...responses,
				},
			};
			await options.context.document.atomic()
				.set([
					"identities",
					options.identityComponent!.identityId,
					"components",
					options.componentId,
				], identityComponent)
				.commit();
			return Promise.resolve(true);
		}
		return Promise.resolve(false);
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
	setupIdentityComponent(
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
				...value,
			},
			confirmed: true,
		});
	}
}
