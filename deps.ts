import {
	type Static,
	type TSchema,
	TypeBoxError,
} from "npm:@sinclair/typebox@0.32.13/type";
import { Value } from "npm:@sinclair/typebox@0.32.13/value";

export function Assert<T extends TSchema>(
	schema: T,
	value: unknown,
): asserts value is Static<T> {
	if (!Value.Check(schema, value)) {
		throw new TypeBoxError(`Value did not match schema`);
	}
}

export {
	decodeBase32,
	encodeBase32,
} from "https://deno.land/std@0.213.0/encoding/base32.ts";
export { encodeBase64 } from "https://deno.land/std@0.213.0/encoding/base64.ts";
export {
	type Static,
	type TArray,
	type TObject,
	type TSchema,
	type TString,
	Type as t,
} from "npm:@sinclair/typebox@0.32.13";
export { Check, Value } from "npm:@sinclair/typebox@0.32.13/value";
export { FormatRegistry, TypeGuard } from "npm:@sinclair/typebox@0.32.13/type";
export {
	type TypeCheck,
	TypeCompiler,
} from "npm:@sinclair/typebox@0.32.13/compiler";
export {
	extname,
	fromFileUrl,
	join,
	normalize,
	resolve,
} from "https://deno.land/std@0.213.0/path/mod.ts";
export { contentType } from "https://deno.land/std@0.213.0/media_types/mod.ts";
export {
	generateKeyPair,
	type JWTPayload,
	jwtVerify,
	type KeyLike,
	SignJWT,
} from "npm:jose@5.2.0";
export type { OpenAPIV3 } from "npm:openapi-types@12.1.3";
