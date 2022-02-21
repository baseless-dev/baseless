import { Command, Result } from "https://baseless.dev/x/shared/server.ts";
import { App } from "../app.ts";

export interface ITransport {
	send(app: App, command: Command): Promise<Result>;
}
