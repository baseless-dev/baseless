import { LoginMethod, LoginType } from "https://baseless.dev/x/baseless/auth/signInMethod.ts";

export function emailOTP(): LoginMethod {
	return { type: LoginType.OneTimePassword };
}
