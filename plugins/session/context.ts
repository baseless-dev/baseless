import type { SessionService } from "./session.ts";

export interface SessionContext {
	readonly session: SessionService;
}
