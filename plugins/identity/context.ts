import type { IdentityService } from "./identity.ts";

export interface IdentityContext {
	readonly identity: IdentityService;
}
