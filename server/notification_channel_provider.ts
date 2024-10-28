import type { IdentityChannel } from "@baseless/core/identity";
import type { Notification } from "@baseless/core/notification";

export interface NotificationChannelProvider {
	verify: (identityChannel: IdentityChannel) => Promise<boolean>;
	send: (identityChannel: IdentityChannel, notification: Notification) => Promise<boolean>;
}
