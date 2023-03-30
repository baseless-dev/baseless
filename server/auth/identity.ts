export type Identity = AnonymousIdentity | KnownIdentity;

export interface AnonymousIdentity {
	readonly id: string;
}

export interface KnownIdentity extends AnonymousIdentity {
	readonly email: string;
	readonly emailConfirmed: boolean;
}
