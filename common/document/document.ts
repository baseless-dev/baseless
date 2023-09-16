import { func } from "../schema/schema.ts";
import {
	InvalidDocumentDataArrayError,
	InvalidDocumentDataError,
	InvalidDocumentDataIncrementError,
	InvalidDocumentDataObjectError,
	InvalidDocumentDataPrimitiveError,
	InvalidDocumentKeyError,
} from "./errors.ts";

export type DocumentKey = string[];

export type DocumentDataPrimitive = string | number | boolean | null;

export type DocumentDataObject = {
	[key: string]: DocumentData;
};

export type DocumentDataArray = Array<DocumentData>;

export type DocumentData =
	| DocumentDataPrimitive
	| DocumentDataObject
	| DocumentDataArray;

export interface Document<Data = unknown> {
	readonly key: DocumentKey;
	readonly data: Readonly<Data>;
}

export function isDocumentKey(value?: unknown): value is DocumentKey {
	return !!value && Array.isArray(value) &&
		value.every((v) => typeof v === "string");
}

export function assertDocumentKey(
	value?: unknown,
): asserts value is DocumentKey {
	if (!isDocumentKey(value)) {
		throw new InvalidDocumentKeyError();
	}
}

export function isDocumentDataPrimitive(
	value?: unknown,
): value is DocumentDataPrimitive {
	return typeof value === "string" || typeof value === "number" ||
		typeof value === "boolean" || value === null;
}

export function assertDocumentDataPrimitive(
	value?: unknown,
): asserts value is DocumentDataPrimitive {
	if (!isDocumentDataPrimitive(value)) {
		throw new InvalidDocumentDataPrimitiveError();
	}
}

export function isDocumentDataObject(
	value?: unknown,
): value is DocumentDataObject {
	return !!value && typeof value === "object" && !Array.isArray(value) &&
		Object.values(value).every((v) => isDocumentData(v));
}

export function assertDocumentDataObject(
	value?: unknown,
): asserts value is DocumentDataObject {
	if (!isDocumentDataObject(value)) {
		throw new InvalidDocumentDataObjectError();
	}
}

export function isDocumentDataArray(
	value?: unknown,
): value is DocumentDataArray {
	return !!value && Array.isArray(value) &&
		value.every((v) => isDocumentData(v));
}

export function assertDocumentDataArray(
	value?: unknown,
): asserts value is DocumentDataArray {
	if (!isDocumentDataArray(value)) {
		throw new InvalidDocumentDataArrayError();
	}
}

export function isDocumentData(value?: unknown): value is DocumentData {
	return isDocumentDataPrimitive(value) || isDocumentDataObject(value) ||
		isDocumentDataArray(value);
}

export function assertDocumentData(
	value?: unknown,
): asserts value is DocumentData {
	if (!isDocumentData(value)) {
		throw new InvalidDocumentDataError();
	}
}
