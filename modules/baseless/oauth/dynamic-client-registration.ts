/// OAuth 2.0 Dynamic Client Registration Protocol
/// https://www.rfc-editor.org/rfc/rfc7591

//import { JWK } from "./rfc7517.ts";
import { JWK } from "https://deno.land/x/jose@v4.9.2/types.d.ts";
import { ClientProvider } from "../provider/client.ts";

export type LanguageSubtag = string;
export type TranslatableMetadataKeys = "client_name" | "logo_uri" | "contacts" | "tos_uri" | "policy_uri";
export type TranslatableMetadata = `${TranslatableMetadataKeys}#${LanguageSubtag}`;

/**
 * Client Metadata
 * @see {@link https://www.rfc-editor.org/rfc/rfc7591#section-2}
 */
export interface ClientMetadata {
	redirect_uris?: string[];
	token_endpoint_auth_method?: "none" | "client_secret_post" | "client_secret_basic";
	grant_types?: string[];
	response_types?: string[];
	client_name?: string;
	client_uri?: string;
	logo_uri?: string;
	scope?: string;
	contacts?: string[];
	tos_uri?: string;
	policy_uri?: string;
	jwks_uri?: string;
	jwks?: JWK[];
	software_id?: string;
	software_version?: string;
	software_statement?: string;
	[translatable: TranslatableMetadata]: string;
	[extension: string]: unknown;
}

/**
 * Client Information Response
 * @see {@link https://www.rfc-editor.org/rfc/rfc7591#section-3.2.1}
 */
export interface ClientInformationResponse extends ClientMetadata {
	client_id: string;
	client_secret?: string;
	client_id_issued_at?: string;
	client_secret_expires_at: string;
}

/**
 * Client Registration Request
 * @see {@link https://www.rfc-editor.org/rfc/rfc7591#section-3}
 */
export async function handleClientRegistration(
	request: Request,
	_clientProvider: ClientProvider,
): Promise<Response> {
	if (request.method !== "POST") {
		return new Response(null, { status: 405 });
	}

	if (request.headers.get("Content-Type") !== "application/json") {
		return new Response(null, { status: 415 });
	}

	// TODO: Open registration or force Authorization?
	// TODO: Software statement https://www.rfc-editor.org/rfc/rfc7591#section-2.3 ?

	try {
		const buffer = await request.arrayBuffer();
		const body = new TextDecoder().decode(buffer);
		const _data = JSON.parse(body) as Record<string, unknown>;

		// TODO validate ClientMetadata?
	} catch (_inner) {
		return new Response(
			JSON.stringify({ error: "invalid_client_metadata" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	// TODO Generate ClientInformationResponse
	// const clientInformation: ClientInformationResponse = {
	// 	...clientMetadata
	// 	client_id: "",
	// 	client_secret_expires_at: "",
	// };
	// TODO Generate Client and store it
	// await clientProvider.add(data);

	// return new Response(
	// 	JSON.stringify(clientInformation),
	// 	{ status: 201, headers: { "Content-Type": "application/json" } }
	// );

	return new Response(
		JSON.stringify({ error: "unimplemented" }),
		{ status: 500, headers: { "Content-Type": "application/json" } },
	);
}
