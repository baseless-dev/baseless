export class SessionIDNotFoundError extends Error {
	name = "SessionIDNotFoundError" as const;
}
export class SessionCreateError extends Error {
	name = "SessionCreateError" as const;
}
export class SessionUpdateError extends Error {
	name = "SessionUpdateError" as const;
}
export class SessionDestroyError extends Error {
	name = "SessionDestroyError" as const;
}
