import { AuthBuilder } from "../core/auth.ts";
import { ClientsBuilder } from "../core/clients.ts";
import { DatabaseBuilder } from "../core/database.ts";
import { FunctionsBuilder } from "../core/functions.ts";
import { MailBuilder } from "../core/mail.ts";

export { DatabasePermissions } from "../core/database.ts";

export const clients = new ClientsBuilder();
export const auth = new AuthBuilder();
export const database = new DatabaseBuilder();
export const functions = new FunctionsBuilder();
export const mail = new MailBuilder();
