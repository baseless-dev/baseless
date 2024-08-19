export type Persistence = "local" | "session" | "memory";

export function isPersistence(value?: unknown): value is Persistence {
	return value === "local" || value === "session" || value === "memory";
}

export interface Profile {
	access_token: string;
	id_token: string;
	refresh_token?: string;
}

export function isProfile(value?: unknown): value is Profile {
	return !!value && typeof value === "object" && "access_token" in value &&
		typeof value.access_token === "string" && "id_token" in value &&
		typeof value.id_token === "string";
}
