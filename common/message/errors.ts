export class InvalidMessageError extends Error {
	name = "InvalidMessageError" as const;
}
export class MessageSendError extends Error {
	name = "MessageSendError" as const;
}
