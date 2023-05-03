import {
	AuthenticationChallenge,
	AuthenticationIdentification,
	isAuthenticationChallenge,
	isAuthenticationChoice,
	isAuthenticationIdentification,
} from "../../server/auth/flow.ts";
import {
	assertGetStepResult,
	isGetStepReturnResult,
} from "../../server/services/auth.ts";
import Layout from "../components/Layout.tsx";
import { useLoaderData } from "../deps.ts";

export type LoginPageProps = {};

export async function LoginPageLoader() {
	// TODO state
	const resp = await fetch("/api/auth/flow");
	const data = await resp.json();
	assertGetStepResult(data);
	return data;
}

// https://github.com/baseless-dev/baseless/blob/41351d2ba2c914e37152afbedc7557497e7cc31a/server/auth/ui/components/Login.ts
export default function LoginPage({ }: LoginPageProps) {
	const data = useLoaderData() as Awaited<ReturnType<typeof LoginPageLoader>>;
	if (isGetStepReturnResult(data)) {
		// TODO done
		debugger;
		return;
	}
	if (!isAuthenticationChoice(data.step)) {
		// TODO redirect to step prompt
		debugger;
		return;
	}
	const currentLocale = "en";
	const choices = data.step.choices.filter((
		choice,
	): choice is AuthenticationIdentification | AuthenticationChallenge =>
		isAuthenticationIdentification(choice) || isAuthenticationChallenge(choice)
	);
	return (
		<Layout title="Login">
			<div className="space-y-6">
				<nav className="space-y-1" aria-label="Sidebar">
					{choices.map((choice) => (
						<a
							href="#"
							title={choice.label[currentLocale]}
							className="group min-w-full flex items-center rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900"
						>
							<svg
								className="-ml-1 mr-3 h-6 w-6 flex-shrink-0 text-slate-400 group-hover:text-slate-500"
								viewBox="0 0 24 24"
								fill="currentColor"
								aria-hidden="true"
								dangerouslySetInnerHTML={{ __html: choice.icon }}
							/>
							<span className="truncate">{choice.label[currentLocale]}</span>
						</a>
					))}
				</nav>
			</div>
		</Layout>
	);
}
