import { AuthViewLoginParams } from "../../../auth/config.ts";
import { AuthStepEmailDefinition, authStepIdent, AuthStepNodeDefinition, AuthStepOAuthDefinition, AuthStepPasswordDefinition } from "../../../auth/flow.ts";
import { Localization } from "../localization.ts";
import { AuthUIContext } from "../mod.ts";
import Layout from "./Layout.ts";

type AuthStepOAuthProps = { step: AuthStepOAuthDefinition; l10n: Localization; currentLocale: string };
type AuthStepEmailProps = { step: AuthStepEmailDefinition; l10n: Localization; currentLocale: string };
type AuthStepPasswordProps = { step: AuthStepPasswordDefinition; l10n: Localization; currentLocale: string };

export default function Login({ steps, isFirstStep, currentLocale, localization }: AuthUIContext & AuthViewLoginParams) {
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
					${!isFirstStep && `<form action="/auth/login" method="POST" autocomplete="off">
						<button type="submit" class="back" name="action" value="back">
							<figure>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>chevron-left</title><path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" /></svg>
							</figure>
							Choose an other method
						</button>
					</form>` || ""
		}
					<form action="/auth/login" method="GET" autocomplete="off">
						<ul>
							${steps.type === "oneOf" && steps.steps.map((step) => AuthStep({ step, l10n, currentLocale })).join("") || ""}
							${steps.type !== "oneOf" && AuthStep({ step: steps, l10n, currentLocale }) || ""}
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
			input = AuthStepEmail(props as AuthStepEmailProps);
			break;
		case "password":
			input = AuthStepPassword(props as AuthStepPasswordProps);
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

function AuthStepEmail({ step, currentLocale }: { step: AuthStepEmailDefinition; currentLocale: string }) {
	return `<button
			type="submit"
			name="action"
			value="email"
			title="${step.providerLabel[currentLocale]}"
		>
			<figure>
				${step.providerIcon}
			</figure>
			<span>${step.providerLabel[currentLocale]}</span>
		</button>`;
}

function AuthStepPassword({ step, currentLocale }: { step: AuthStepPasswordDefinition; currentLocale: string }) {
	return `<button
			type="submit"
			name="action"
			value="password"
			title="${step.providerLabel[currentLocale]}"
		>
			<figure>
			${step.providerIcon}
			</figure>
			<span>${step.providerLabel[currentLocale]}</span>
		</button>`;
}

function AuthStepOAuth({ step, currentLocale }: AuthStepOAuthProps) {
	const id = authStepIdent(step);
	return `<button
			type="submit"
			name="action"
			value="${id}"
			title="${step.config.providerLabel[currentLocale]}"
		>
			<figure>${step.config.providerIcon}</figure>
			<span>${step.config.providerLabel[currentLocale]}</span>
		</button>`;
}
