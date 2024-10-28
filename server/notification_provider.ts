import type { Identity, IdentityChannel } from "@baseless/core/identity";
import type { Notification } from "@baseless/core/notification";

export interface NotificationProvider {
	notify: (identityId: Identity["identityId"], notification: Notification) => Promise<boolean>;
	unsafeNotify: (identityChannel: IdentityChannel, notification: Notification) => Promise<boolean>;
}
