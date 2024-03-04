import {
	type Static,
	type TSchema,
	TypeBoxError,
} from "npm:@sinclair/typebox@0.32.13/type";
import { Value } from "npm:@sinclair/typebox@0.32.13/value";

export { Value } from "npm:@sinclair/typebox@0.32.13/value";
export {
	type Static,
	type TArray,
	type TObject,
	type TSchema,
	type TString,
	Type as t,
} from "npm:@sinclair/typebox@0.32.13";

export function Assert<T extends TSchema>(
	schema: T,
	value: unknown,
): asserts value is Static<T> {
	if (!Value.Check(schema, value)) {
		throw new TypeBoxError(`Value did not match schema`);
	}
}
