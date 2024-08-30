import { Identity } from "@baseless/core/identity";
import { Notification, NotificationTransport } from "@baseless/core/notification";

export interface NotificationProvider {
	getNotificationTransports: (
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	) => Promise<NotificationTransport>;
	addTransportToIdentity: (
		identityId: Identity["identityId"],
		transport: NotificationTransport,
	) => Promise<boolean>;
	listTransportsForIdentity: (
		identityId: Identity["identityId"],
	) => Promise<NotificationTransport[]>;
	removeTransportFromIdentity: (
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	) => Promise<boolean>;
	sendNotification: (
		identityId: Identity["identityId"],
		notification: Notification,
	) => Promise<boolean>;
}
