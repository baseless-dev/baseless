import type { JWTPayload, KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";

export interface Session {
	id?: string;
	flow: string[];
}

export function assertsSession(value?: unknown): asserts value is Session {
	if (!value || typeof value !== "object" || !("flow" in value) || !Array.isArray(value.flow) || value.flow.some(v => typeof v !== "string")) {
		throw new Error(`Value is not a session.`);
	}
}

export async function deserializeSession(data: string, publicKey: KeyLike): Promise<Session> {
	const { payload } = await jwtVerify(data, publicKey);
	assertsSession(payload);
	return payload;
}

export async function serializeSession(session: Session, alg: string, privateKey: KeyLike): Promise<string> {
	assertsSession(session);
	return await new SignJWT(session as unknown as JWTPayload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime('15m')
		.sign(privateKey);
}