import type { Identity } from "../../identity/identity.ts";
import type { AutoId } from "../../system/autoid.ts";
import type { Message } from "../../message/message.ts";

export interface IIdentityService {
	get(identityId: AutoId): Promise<Identity>;
	getByIdentification(type: string, identification: string): Promise<Identity>;
	create(
		meta: Record<string, unknown>,
		components: Identity["components"],
	): Promise<Identity>;
	update(
		identity: Identity,
	): Promise<void>;
	delete(identityId: AutoId): Promise<void>;
	broadcastMessage(
		identityId: AutoId,
		component: string,
		message: Omit<Message, "recipient">,
	): Promise<void>;
	sendMessage(
		identityId: AutoId,
		component: string,
		message: Omit<Message, "recipient">,
	): Promise<void>;
	sendComponentValidationCode(
		identityId: AutoId,
		component: string,
		locale: string,
	): Promise<void>;
	confirmComponentValidationCode(code: string): Promise<void>;
}
