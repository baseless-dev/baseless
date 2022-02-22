import { assertEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { AuthBuilder } from "./auth.ts";

Deno.test("allow anonymous user", () => {
	assertEquals({
		allowAnonymousUser: true,
		allowSignMethodPassword: false,
		onCreateUser: undefined,
		onUpdateUser: undefined,
		onDeleteUser: undefined,
	}, new AuthBuilder().allowAnonymousUser(true).build());
});

Deno.test("allow sign method password", () => {
	assertEquals({
		allowAnonymousUser: false,
		allowSignMethodPassword: true,
		onCreateUser: undefined,
		onUpdateUser: undefined,
		onDeleteUser: undefined,
	}, new AuthBuilder().allowSignMethodPassword(true).build());
});

Deno.test("on create user", () => {
	const callback = () => Promise.resolve();
	assertEquals({
		allowAnonymousUser: false,
		allowSignMethodPassword: false,
		onCreateUser: callback,
		onUpdateUser: undefined,
		onDeleteUser: undefined,
	}, new AuthBuilder().onCreateUser(callback).build());
});

Deno.test("on update user", () => {
	const callback = () => Promise.resolve();
	assertEquals({
		allowAnonymousUser: false,
		allowSignMethodPassword: false,
		onCreateUser: undefined,
		onUpdateUser: callback,
		onDeleteUser: undefined,
	}, new AuthBuilder().onUpdateUser(callback).build());
});

Deno.test("on delete user", () => {
	const callback = () => Promise.resolve();
	assertEquals({
		allowAnonymousUser: false,
		allowSignMethodPassword: false,
		onCreateUser: undefined,
		onUpdateUser: undefined,
		onDeleteUser: callback,
	}, new AuthBuilder().onDeleteUser(callback).build());
});
