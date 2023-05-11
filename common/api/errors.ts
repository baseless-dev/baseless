export class InvalidApiResponseDataError extends Error {
	name = "InvalidApiResponseDataError" as const;
}

export class InvalidApiResponseErrorError extends Error {
	name = "InvalidApiResponseErrorError" as const;
}

export class InvalidApiResponseError extends Error {
	name = "InvalidApiResponseError" as const;
}
