import { AuthViewLoginParams } from "https://baseless.dev/x/baseless/auth/config.ts";
import { authStepIdent, AuthStepNodeDefinition, AuthStepOAuthDefinition } from "https://baseless.dev/x/baseless/auth/flow.ts";
import { Localization } from "../localization.ts";
import { AuthUIContext } from "../mod.ts";
import Layout from "./Layout.ts";

export default function Login({ nextStep, currentLocale, localization }: AuthUIContext & AuthViewLoginParams) {
	const l10n = localization[currentLocale];
	return Layout({ title: l10n.heading }, [
		`<section id="login">
			<header>
				<figure>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>all-inclusive</title><path d="M18.6,6.62C17.16,6.62 15.8,7.18 14.83,8.15L7.8,14.39C7.16,15.03 6.31,15.38 5.4,15.38C3.53,15.38 2,13.87 2,12C2,10.13 3.53,8.62 5.4,8.62C6.31,8.62 7.16,8.97 7.84,9.65L8.97,10.65L10.5,9.31L9.22,8.2C8.2,7.18 6.84,6.62 5.4,6.62C2.42,6.62 0,9.04 0,12C0,14.96 2.42,17.38 5.4,17.38C6.84,17.38 8.2,16.82 9.17,15.85L16.2,9.61C16.84,8.97 17.69,8.62 18.6,8.62C20.47,8.62 22,10.13 22,12C22,13.87 20.47,15.38 18.6,15.38C17.7,15.38 16.84,15.03 16.16,14.35L15,13.34L13.5,14.68L14.78,15.8C15.8,16.81 17.15,17.37 18.6,17.37C21.58,17.37 24,14.96 24,12C24,9 21.58,6.62 18.6,6.62Z" /></svg>
				</figure>
				<h1>
					Sign in to your account
				</h1>
			</header>
			<div class="box">
				<main>
					<form action="/auth/login" method="POST" autocomplete="off">
						<button type="submit" class="back" name="action" value="back">
							<figure>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>chevron-left</title><path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" /></svg>
							</figure>
							Choose an other method
						</button>
					</form>
					<form action="/auth/login" method="GET" autocomplete="off">
						<ul>
							${nextStep.type === "oneOf" && nextStep.steps.map((step) => AuthStep({ step, l10n, currentLocale })).join("") || ""}
							${nextStep.type !== "oneOf" && AuthStep({ step: nextStep, l10n, currentLocale }) || ""}
						</ul>
					</form>
				</main>
			</div>
		</section>`,
	]);
}

function AuthStep(props: { step: AuthStepNodeDefinition; l10n: Localization; currentLocale: string }) {
	let input: string;
	switch (props.step.type) {
		case "email":
			input = AuthStepEmail(props);
			break;
		case "password":
			input = AuthStepPassword(props);
			break;
		case "oauth":
			input = AuthStepOAuth(props as AuthStepOAuthProps);
			break;
		default:
			input = `<button
						disabled
						title="Unknown provider"
					>
						<figure>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>alert</title><path d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z" /></svg>
						</figure>
						<span>Unknown provider</span>
					</button>`;
	}
	return `<li>
			${input}
		</li>`;
}

function AuthStepEmail({ l10n }: { step: AuthStepNodeDefinition; l10n: Localization }) {
	return `<button
			type="submit"
			name="action"
			autofocus
			value="email"
			title="Sign-in with Email"
		>
			<figure>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>at</title><path d="M12,15C12.81,15 13.5,14.7 14.11,14.11C14.7,13.5 15,12.81 15,12C15,11.19 14.7,10.5 14.11,9.89C13.5,9.3 12.81,9 12,9C11.19,9 10.5,9.3 9.89,9.89C9.3,10.5 9,11.19 9,12C9,12.81 9.3,13.5 9.89,14.11C10.5,14.7 11.19,15 12,15M12,2C14.75,2 17.1,3 19.05,4.95C21,6.9 22,9.25 22,12V13.45C22,14.45 21.65,15.3 21,16C20.3,16.67 19.5,17 18.5,17C17.3,17 16.31,16.5 15.56,15.5C14.56,16.5 13.38,17 12,17C10.63,17 9.45,16.5 8.46,15.54C7.5,14.55 7,13.38 7,12C7,10.63 7.5,9.45 8.46,8.46C9.45,7.5 10.63,7 12,7C13.38,7 14.55,7.5 15.54,8.46C16.5,9.45 17,10.63 17,12V13.45C17,13.86 17.16,14.22 17.46,14.53C17.76,14.84 18.11,15 18.5,15C18.92,15 19.27,14.84 19.57,14.53C19.87,14.22 20,13.86 20,13.45V12C20,9.81 19.23,7.93 17.65,6.35C16.07,4.77 14.19,4 12,4C9.81,4 7.93,4.77 6.35,6.35C4.77,7.93 4,9.81 4,12C4,14.19 4.77,16.07 6.35,17.65C7.93,19.23 9.81,20 12,20H17V22H12C9.25,22 6.9,21 4.95,19.05C3,17.1 2,14.75 2,12C2,9.25 3,6.9 4.95,4.95C6.9,3 9.25,2 12,2Z" /></svg>
			</figure>
			<span>Sign-in with Email</span>
		</button>`;
}

function AuthStepPassword({ l10n }: { step: AuthStepNodeDefinition; l10n: Localization }) {
	return `<button
			type="submit"
			name="action"
			autofocus
			value="password"
			title="Sign-in with Password"
		>
			<figure>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>form-textbox-password</title><path d="M17,7H22V17H17V19A1,1 0 0,0 18,20H20V22H17.5C16.95,22 16,21.55 16,21C16,21.55 15.05,22 14.5,22H12V20H14A1,1 0 0,0 15,19V5A1,1 0 0,0 14,4H12V2H14.5C15.05,2 16,2.45 16,3C16,2.45 16.95,2 17.5,2H20V4H18A1,1 0 0,0 17,5V7M2,7H13V9H4V15H13V17H2V7M20,15V9H17V15H20M8.5,12A1.5,1.5 0 0,0 7,10.5A1.5,1.5 0 0,0 5.5,12A1.5,1.5 0 0,0 7,13.5A1.5,1.5 0 0,0 8.5,12M13,10.89C12.39,10.33 11.44,10.38 10.88,11C10.32,11.6 10.37,12.55 11,13.11C11.55,13.63 12.43,13.63 13,13.11V10.89Z" /></svg>
			</figure>
			<span>Sign-in with Password</span>
		</button>`;
}

type AuthStepOAuthProps = { step: AuthStepOAuthDefinition; l10n: Localization; currentLocale: string };

function AuthStepOAuth({ step, currentLocale }: AuthStepOAuthProps) {
	const id = authStepIdent(step);
	return `<button
			type="submit"
			name="action"
			autofocus
			value="${id}"
			title="${step.config.providerLabel[currentLocale]}"
		>
			<figure>${step.config.providerIcon}</figure>
			<span>${step.config.providerLabel[currentLocale]}</span>
		</button>`;
}