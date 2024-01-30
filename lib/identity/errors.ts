export class IdentityNotFoundError extends Error {
	name = "IdentityNotFoundError" as const;
}
export class IdentityExistsError extends Error {
	name = "IdentityExistsError" as const;
}
export class IdentityCreateError extends Error {
	name = "IdentityCreateError" as const;
}
export class IdentityUpdateError extends Error {
	name = "IdentityUpdateError" as const;
}
export class IdentityDeleteError extends Error {
	name = "IdentityDeleteError" as const;
}
export class IdentityComponentNotFoundError extends Error {
	name = "IdentityComponentNotFoundError" as const;
}
export class IdentityComponentCreateError extends Error {
	name = "IdentityComponentCreateError" as const;
}
export class IdentityComponentUpdateError extends Error {
	name = "IdentityComponentUpdateError" as const;
}
export class IdentityComponentDeleteError extends Error {
	name = "IdentityComponentDeleteError" as const;
}
export class IdentityComponentExistsError extends Error {
	name = "IdentityComponentExistsError" as const;
}