import { LoginMethod, LoginType } from "https://baseless.dev/x/baseless/auth/signInMethod.ts";

export class OTPEmailLoginMethod extends LoginMethod {
	public readonly type = LoginType.OneTimePassword;
}

export function emailOTP() {
	return new OTPEmailLoginMethod();
}