/// OAuth 2.0 Dynamic Client Registration Management Protocol
/// https://www.rfc-editor.org/rfc/rfc7592

import { ClientProvider } from "../provider/client.ts";
import { ClientInformationResponse as ClientInformationResponseBase } from "./dynamic-client-registration.ts";

export interface ClientInformationResponse extends ClientInformationResponseBase {
	registration_client_uri: string;
	registration_access_token: string;
}

/**
 * Client Read Request
 * @see {@link https://www.rfc-editor.org/rfc/rfc7592#section-2.1}
 */
export async function handleClientRead(
	request: Request,
	_clientProvider: ClientProvider,
): Promise<Response> {
	if (request.method !== "GET") {
		return new Response(null, { status: 405 });
	}

	const url = new URL(request.url);
	const client_id = url.pathname.replace(/^\/+/, "").split("/").pop();

	return new Response(
		JSON.stringify({ error: "unimplemented" }),
		{ status: 500, headers: { "Content-Type": "application/json" } },
	);

	// TODO Fetch client_id
	// const clientInformation = await clientProvider.get(client_id);

	// TODO Validate authorization

	// TODO Generate ClientInformationResponse
	// const clientInformation: ClientInformationResponse = {
	// 	...clientInformation
	// 	registration_client_uri: "",
	// 	registration_access_token: "",
	// };

	return new Response(
		JSON.stringify({ error: "unimplemented" }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

/**
 * Client Update Request
 * @see {@link https://www.rfc-editor.org/rfc/rfc7592#section-2.2}
 */
export async function handleClientUpdate(
	request: Request,
	_clientProvider: ClientProvider,
): Promise<Response> {
	if (request.method !== "PUT") {
		return new Response(null, { status: 405 });
	}

	return new Response(
		JSON.stringify({ error: "unimplemented" }),
		{ status: 500, headers: { "Content-Type": "application/json" } },
	);
}

/**
 * Client Delete Request
 * @see {@link https://www.rfc-editor.org/rfc/rfc7592#section-2.3}
 */
export async function handleClientDelete(
	request: Request,
	_clientProvider: ClientProvider,
): Promise<Response> {
	if (request.method !== "DELETE") {
		return new Response(null, { status: 405 });
	}

	return new Response(
		JSON.stringify({ error: "unimplemented" }),
		{ status: 500, headers: { "Content-Type": "application/json" } },
	);
}
